/**
 * Copyright (c) 2024-2026 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
/**
 * Async generator to iterate over a collection in chunks
 * @param collection - The collection to iterate over
 * @param chunkSize - The size of each chunk
 * @returns An async generator that yields chunks of the collection
 */
export async function* toAsyncIterable<T>(
  collection: Iterable<T>,
): AsyncIterable<T> {
  for await (const item of collection) {
    yield item
  }
}
