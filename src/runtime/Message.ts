import { Response } from './Response'

export interface Message {
  function: string
  argument?: any
}

export const sendMessage = async (message: Message): Promise<Response> => {
  return await chrome.runtime.sendMessage(message)
}
