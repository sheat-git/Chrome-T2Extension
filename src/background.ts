import { Response } from './runtime/Response'
import { Message } from './runtime/Message'

chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse: (response: Response) => any) => {
    switch (message.function) {
      case 'openOptionsPage':
        chrome.runtime.openOptionsPage()
        return true
    }
  },
)
