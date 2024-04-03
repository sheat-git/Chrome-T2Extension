export type Response =
  | {
      data: any
      error: null
    }
  | {
      data: null
      error: Error
    }
