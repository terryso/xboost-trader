import { describe, it, expect } from 'vitest'
import { BaseRepository } from '../../../src/repositories/BaseRepository'

describe('BaseRepository', () => {
  it('should be defined', () => {
    expect(BaseRepository).toBeDefined()
  })
})