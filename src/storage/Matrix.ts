import { getBucket } from '@extend-chrome/storage'

type MatrixRow = [string, string, string, string, string, string, string]

export type Matrix = {
  value: [
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
    MatrixRow,
  ]
}

export const matrixBucket = getBucket<Matrix>('matrix', 'sync')
