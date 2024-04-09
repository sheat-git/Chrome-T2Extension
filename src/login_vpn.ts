import { accountBucket } from './storage/Accout'

const main = async () => {
  const account = await accountBucket.get()
  document.querySelector('input[name="password"]' as 'input')!.value =
    account.password
  document.querySelector('input[type="submit"]' as 'input')!.click()
}

main()
