import React, { useEffect, useRef, useState } from 'react'
import { render } from './config'
import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  GridItem,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Spacer,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import { accountBucket } from './storage/Accout'
import { Matrix, matrixBucket } from './storage/Matrix'

type MatrixValue = Matrix['value']

const App = () => {
  const translation = useTranslation()
  const toast = useToast()
  const [id, setId] = useState('')
  const [idIsInvalid, setIdIsInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordIsInvalid, setPasswordIsInvalid] = useState(false)
  const [matrix, setMatrix] = useState(
    [...Array(10)].map(() => Array(7).fill('')) as MatrixValue,
  )
  const matrixRefs = useRef<Array<HTMLInputElement | null>>(
    Array(70).fill(null),
  )
  const [matrixItemIsInvalid, setMatrixItemIsInvalid] = useState<boolean[][]>(
    [...Array(10)].map(() => Array(7).fill(false)),
  )

  const validate = () => {
    const idIsValid = id.length > 0
    const passwordIsValid = password.length > 0
    const martixItemIsInvalid = matrix.map((row) =>
      row.map((c) => c.length !== 1),
    )
    setIdIsInvalid(!idIsValid)
    setPasswordIsInvalid(!passwordIsValid)
    setMatrixItemIsInvalid(matrixItemIsInvalid)
    return (
      idIsValid && passwordIsValid && !martixItemIsInvalid.flat().some((b) => b)
    )
  }

  // 値の初期化
  useEffect(() => {
    accountBucket.get().then((account) => {
      if (account.id !== undefined) setId(account.id)
      if (account.password !== undefined) setPassword(account.password)
    })
    matrixBucket.get().then((matrix) => {
      if (matrix.value !== undefined) setMatrix(matrix.value)
    })
  }, [])

  // キーイベントの登録
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      if (!(activeElement instanceof HTMLInputElement)) return
      const currentIndex = matrixRefs.current.indexOf(activeElement)
      if (currentIndex === -1) return
      const focus = (index: number) => {
        if (index < 0 || index >= 70) return
        const element = matrixRefs.current[index]
        if (!element) return
        e.preventDefault()
        element.focus()
      }
      switch (e.key) {
        case 'ArrowLeft':
          focus(currentIndex - 1)
          break
        case 'ArrowRight':
          focus(currentIndex + 1)
          break
        case 'ArrowUp':
          focus(currentIndex - 10)
          break
        case 'ArrowDown':
          focus(currentIndex + 10)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const t = (key: string): string => translation.t(`Options.${key}`)

  return (
    <VStack margin={4}>
      <FormControl isInvalid={idIsInvalid}>
        <FormLabel>{t('ACCOUNT')}</FormLabel>
        <Input value={id} onChange={(e) => setId(e.target.value)} />
      </FormControl>
      <FormControl isInvalid={passwordIsInvalid}>
        <FormLabel>{t('PASSWORD')}</FormLabel>
        <InputGroup>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <InputRightElement>
            <IconButton
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              icon={showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
              variant="ghost"
              onClick={() => setShowPassword(!showPassword)}
            />
          </InputRightElement>
        </InputGroup>
      </FormControl>
      <Flex w="100%">
        <FormLabel>{t('MATRIX')}</FormLabel>
        <Spacer />
        <Button
          size="xs"
          onClick={() =>
            navigator.clipboard
              .readText()
              .then((value) => {
                const parsed = JSON.parse(value)
                if (
                  Array.isArray(parsed) &&
                  parsed.length === 70 &&
                  parsed.every((c) => typeof c === 'string' && c.length === 1)
                ) {
                  const matrix: string[][] = []
                  for (let i = 0; i < 10; i++) {
                    matrix.push(
                      parsed
                        .slice(i * 7, i * 7 + 7)
                        .map((c) => (c as string).toUpperCase()),
                    )
                  }
                  setMatrix(matrix as MatrixValue)
                  toast({
                    title: t('IMPORTED'),
                    status: 'success',
                    isClosable: true,
                  })
                } else {
                  toast({
                    title: t('INVALID_VALUE'),
                    status: 'error',
                    isClosable: true,
                  })
                }
              })
              .catch(() =>
                toast({
                  title: t('UNKNOWN_ERROR'),
                  status: 'error',
                  isClosable: true,
                }),
              )
          }
        >
          {t('IMPORT')}
        </Button>
        <Box w="4px" />
        <Button
          size="xs"
          onClick={() =>
            navigator.clipboard
              .writeText(JSON.stringify(matrix.flat()))
              .then(() =>
                toast({
                  title: t('COPIED'),
                  status: 'success',
                  isClosable: true,
                }),
              )
              .catch(() =>
                toast({
                  title: t('UNKNOWN_ERROR'),
                  status: 'error',
                  isClosable: true,
                }),
              )
          }
        >
          {t('EXPORT')}
        </Button>
      </Flex>
      <SimpleGrid columns={11}>
        <GridItem />
        {[...Array(10)].map((_, i) => (
          <GridItem key={`Column${i}`}>
            <Center h="100%" w="100%">
              <Text as="b">{String.fromCharCode(65 + i)}</Text>
            </Center>
          </GridItem>
        ))}
        {[...Array(7)].map((_, i) => (
          <React.Fragment key={`Row${i}`}>
            <GridItem>
              <Center h="100%" w="100%">
                <Text as="b">{i + 1}</Text>
              </Center>
            </GridItem>
            {[...Array(10)].map((_, j) => (
              <GridItem key={`Item${j},${i}`}>
                <Center h="100%" w="100%">
                  <FormControl isInvalid={matrixItemIsInvalid[j][i]}>
                    <Input
                      variant="filled"
                      size="sm"
                      textAlign="center"
                      padding="0"
                      maxLength={1}
                      ref={(e) => (matrixRefs.current[i * 10 + j] = e)}
                      onFocus={(e) => e.target.select()}
                      value={matrix[j][i]}
                      onChange={(e) => {
                        setMatrix((prev) => {
                          const next = [...prev] as MatrixValue
                          next[j][i] = e.target.value.slice(0, 1).toUpperCase()
                          return next
                        })
                        if (e.target.value) {
                          const nextIndex = i * 10 + j + 1
                          if (nextIndex < 70) {
                            matrixRefs.current[nextIndex]?.focus()
                          }
                        }
                      }}
                    />
                  </FormControl>
                </Center>
              </GridItem>
            ))}
          </React.Fragment>
        ))}
      </SimpleGrid>
      <Button
        variant="solid"
        bgColor="#005C92"
        color="white"
        _hover={{ bgColor: '#005C9280' }}
        onClick={() => {
          if (validate()) {
            Promise.all([
              accountBucket.set({ id, password }),
              matrixBucket.set({ value: matrix }),
            ])
              .then(() =>
                toast({
                  title: t('SAVED'),
                  status: 'success',
                  isClosable: true,
                }),
              )
              .catch(() =>
                toast({
                  title: t('UNKNOWN_ERROR'),
                  status: 'error',
                  isClosable: true,
                }),
              )
          } else {
            toast({
              title: t('INVALID_VALUE'),
              status: 'error',
              isClosable: true,
            })
          }
        }}
      >
        {t('SAVE')}
      </Button>
    </VStack>
  )
}

render(<App />)
