import React, { Reducer, useEffect, useState } from 'react'
import { AsyncActionHandlers, useReducerAsync } from 'use-reducer-async'
import { useTranslation } from 'react-i18next'
import { Account, accountBucket } from '../storage/Accout'
import { Matrix, matrixBucket } from '../storage/Matrix'
import { HTMLElement, parse } from 'node-html-parser'
import toast, { Toaster } from 'react-hot-toast'
import { sendMessage } from '../runtime/Message'

const LOGIN_URL = 'https://portal.nap.gsic.titech.ac.jp/GetAccess/Login'

type State = ToastState | null

type ToastState = {
  message: ToastMessageState
  status: 'loading' | 'error'
  showOpenOptions?: boolean
}

type ToastMessageState =
  | 'AUTHENTICATING_ACCOUNT'
  | 'AUTHENTICATING_MATRIX'
  | `ERROR_${ErrorState}`

type ErrorState =
  | 'ACCOUNT_NOT_SET'
  | 'MATRIX_NOT_SET'
  | 'LOAD_FAILURE'
  | 'MATRIX_UNAVAILABLE'
  | 'INVALID_STATUS_CODE'
  | 'AUTHENTICATE_FAILURE'

const initialState: State = null

type InnerAction =
  | { type: 'ERROR_LOAD'; error: ErrorState }
  | { type: 'START_AUTHENTICATE' }
  | { type: 'UPDATE_AUTHENTICATE' }
  | { type: 'FINISH_AUTHENTICATE' }
  | { type: 'ERROR_AUTHENTICATE'; error: ErrorState }

type OuterAction = { type: 'OPEN_OPTIONS' }

type Action = InnerAction | OuterAction

const reducer: Reducer<State, Action> = (state: State, action: Action) => {
  switch (action.type) {
    case 'ERROR_LOAD':
      return {
        message: `ERROR_${action.error}`,
        status: 'error',
      }
    case 'START_AUTHENTICATE':
      return {
        message: 'AUTHENTICATING_ACCOUNT',
        status: 'loading',
      }
    case 'UPDATE_AUTHENTICATE':
      return {
        message: 'AUTHENTICATING_MATRIX',
        status: 'loading',
      }
    case 'FINISH_AUTHENTICATE':
      const searchParams = new URLSearchParams(location.href)
      location.href =
        searchParams.get('URI') ??
        searchParams.get('GAURI') ??
        'https://portal.nap.gsic.titech.ac.jp/GetAccess/ResourceList'
      return null
    case 'ERROR_AUTHENTICATE':
      return {
        message: `ERROR_${action.error}`,
        status: 'error',
        showOpenOptions: action.error !== 'MATRIX_UNAVAILABLE',
      }
    case 'OPEN_OPTIONS':
      sendMessage({ function: 'OPEN_OPTIONS_PAGE' })
      return state
  }
}

type AsyncAction = { type: 'AUTHENTICATE' }

const getData = async (): Promise<
  | {
      isError: false
      value: {
        account: Account
        matrix: Matrix
      }
    }
  | {
      isError: true
      value: Action
    }
> => {
  try {
    const [account, matrix] = await Promise.all([
      accountBucket.get(),
      matrixBucket.get(),
    ])
    if (!(account.id !== undefined && account.password !== undefined)) {
      return {
        isError: true,
        value: { type: 'ERROR_LOAD', error: 'ACCOUNT_NOT_SET' },
      }
    }
    if (
      !(
        matrix.value !== undefined &&
        matrix.value.length === 10 &&
        matrix.value.every((row) => row.length === 7)
      )
    ) {
      return {
        isError: true,
        value: { type: 'ERROR_LOAD', error: 'MATRIX_NOT_SET' },
      }
    }
    return {
      isError: false,
      value: {
        account: account,
        matrix: matrix,
      },
    }
  } catch {
    return {
      isError: true,
      value: { type: 'ERROR_LOAD', error: 'LOAD_FAILURE' },
    }
  }
}

const extractInputs = (root: HTMLElement) =>
  root
    .getElementsByTagName('input')
    .reduce((inputs: { [key: string]: string }, input) => {
      inputs[input.attrs['name']] = input.attrs['value'] ?? ''
      return inputs
    }, {})

const asyncActionHandlers: AsyncActionHandlers<
  Reducer<State, Action>,
  AsyncAction
> = {
  AUTHENTICATE:
    ({ dispatch }) =>
    async () => {
      const data = await getData()
      if (data.isError) {
        dispatch(data.value)
        return
      }
      const { account, matrix } = data.value
      dispatch({ type: 'START_AUTHENTICATE' })
      try {
        // Accound, Passwordの認証
        const accountResponse = await fetch(
          LOGIN_URL + '?Template=userpass_key&AUTHMETHOD=UserPassword',
          {
            method: 'GET',
            credentials: 'include',
          },
        )
        if (!accountResponse.ok) {
          dispatch({
            type: 'ERROR_AUTHENTICATE',
            error: 'INVALID_STATUS_CODE',
          })
          return
        }
        const accountRoot = parse(await accountResponse.text())
        const accountInputs = extractInputs(accountRoot)
        accountInputs['usr_name'] = account.id
        accountInputs['usr_password'] = account.password
        const someResponse = await fetch(LOGIN_URL, {
          method: 'POST',
          body: new URLSearchParams(accountInputs),
          referrer: LOGIN_URL,
        })
        if (!someResponse.ok) {
          dispatch({
            type: 'ERROR_AUTHENTICATE',
            error: 'INVALID_STATUS_CODE',
          })
          return
        }

        // Matrix認証へ移行
        const someHtml = await someResponse.text()
        let matrixHtml: string
        let addMessage6: boolean
        const someReplacedHtml = someHtml.replace(
          /<script.*?>.*?<\/script>/gis,
          '',
        )
        if (
          someReplacedHtml.includes('Select Label for OTP') ||
          someReplacedHtml.includes('Token Only')
        ) {
          const someRoot = parse(someHtml, {
            voidTag: { tags: ['option', 'input'] },
          })
          const optionElements = someRoot.getElementsByTagName('option')
          const optionElement = optionElements.find(
            (e) => e.attrs['value'] === 'GridAuthOption',
          )
          if (!optionElement) {
            dispatch({
              type: 'ERROR_AUTHENTICATE',
              error: 'MATRIX_UNAVAILABLE',
            })
            return
          } else {
            dispatch({ type: 'UPDATE_AUTHENTICATE' })
          }
          const someInputs = extractInputs(someRoot)
          for (const selectElement of someRoot.getElementsByTagName('select')) {
            const name = selectElement.attrs['name']
            if (selectElement.childNodes.includes(optionElement)) {
              someInputs[name] = 'GridAuthOption'
            } else {
              someInputs[name] =
                selectElement.getElementsByTagName('option')[0].attrs['value']
            }
          }
          const matrixResponse = await fetch(LOGIN_URL, {
            method: 'POST',
            body: new URLSearchParams(someInputs),
            referrer: LOGIN_URL,
          })
          if (!matrixResponse.ok) {
            dispatch({
              type: 'ERROR_AUTHENTICATE',
              error: 'INVALID_STATUS_CODE',
            })
            return
          }
          matrixHtml = await matrixResponse.text()
          addMessage6 = true
        } else {
          dispatch({ type: 'UPDATE_AUTHENTICATE' })
          matrixHtml = someHtml
          addMessage6 = false
        }

        // Matrix認証
        const matrixRoot = parse(matrixHtml)
        const matrixInputs = extractInputs(matrixRoot)
        matrixHtml
          .match(/\[[A-Z],\d\]/g)
          ?.slice(0, 3)
          .forEach((value, i) => {
            const x = value.charCodeAt(1) - 65 // 'A'
            const y = value.charCodeAt(3) - 49 // '1'
            matrixInputs[`message${i + 3}`] = matrix.value[x][y]
          })
        if (addMessage6) {
          matrixInputs['message6'] = 'NoOtherIGAuthOption'
        }
        const response = await fetch(LOGIN_URL, {
          method: 'POST',
          body: new URLSearchParams(matrixInputs),
          referrer: LOGIN_URL,
        })
        if (!response.ok) {
          dispatch({
            type: 'ERROR_AUTHENTICATE',
            error: 'INVALID_STATUS_CODE',
          })
          return
        }
        dispatch({ type: 'FINISH_AUTHENTICATE' })
      } catch (error) {
        console.log(error)
        dispatch({ type: 'ERROR_AUTHENTICATE', error: 'AUTHENTICATE_FAILURE' })
      }
    },
}

export const Authentication: React.FC = () => {
  const [state, dispatch] = useReducerAsync(
    reducer,
    initialState,
    asyncActionHandlers,
  )
  const translation = useTranslation()
  const [accountToastId, setAccountToastId] = useState<string | null>(null)
  const [matrixToastId, setMatrixToastId] = useState<string | null>(null)

  useEffect(() => {
    dispatch({ type: 'AUTHENTICATE' })
  }, [])

  useEffect(() => {
    if (state) {
      if (accountToastId && state.message === 'AUTHENTICATING_MATRIX') {
        toast.success(t('AUTHENTICATING_ACCOUNT_SUCCESS'), {
          id: accountToastId,
        })
      }
      switch (state.status) {
        case 'loading':
          const id = toast.loading(t(state.message))
          if (state.message === 'AUTHENTICATING_ACCOUNT') {
            setAccountToastId(id)
          } else if (state.message === 'AUTHENTICATING_MATRIX') {
            setMatrixToastId(id)
          }
          break
        case 'error':
          toast.error(
            <div>
              <div>{t(state.message)}</div>
              {state.showOpenOptions && (
                <button onClick={() => dispatch({ type: 'OPEN_OPTIONS' })}>
                  {t('OPEN_OPTIONS')}
                </button>
              )}
            </div>,
            {
              id: matrixToastId ?? accountToastId ?? undefined,
            },
          )
          break
      }
    }
  }, [state])

  const t = (key: string): string => {
    return translation.t(`Authentication.${key}`)
  }

  return <Toaster />
}
