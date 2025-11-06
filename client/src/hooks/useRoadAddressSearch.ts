import { useEffect, useMemo, useRef, useState } from 'react'

type Options = {
  onlyApartments?: boolean
  onlyVillas?: boolean
  limit?: number
  randomize?: boolean
  debounceMs?: number
}

type RawRoadResponse = {
  roadAddress: string
  jibunAddress?: string
  buildingName?: string
  district?: string
}

export type RoadAddressResult = {
  roadAddress: string
  jibunAddress: string
  district: string
  buildingName: string
}

const apartmentKeywords = ['아파트', 'APT', 'apartment', 'Apartment']
const villaKeywords = ['빌라', 'Villa', 'villa', '연립주택']

const includesKeyword = (target: string | undefined, keywords: string[]) => {
  if (!target) return false
  return keywords.some((keyword) => target.includes(keyword))
}

const isApartment = (item: RawRoadResponse) =>
  includesKeyword(item.buildingName, apartmentKeywords) ||
  includesKeyword(item.roadAddress, apartmentKeywords) ||
  includesKeyword(item.jibunAddress, apartmentKeywords)

const isVilla = (item: RawRoadResponse) =>
  includesKeyword(item.buildingName, villaKeywords) ||
  includesKeyword(item.roadAddress, villaKeywords) ||
  includesKeyword(item.jibunAddress, villaKeywords)

const filterByOptions = (item: RawRoadResponse, options: Options) => {
  const { onlyApartments = false, onlyVillas = false } = options

  if (onlyApartments && onlyVillas) {
    return isApartment(item) || isVilla(item)
  }

  if (onlyApartments) {
    return isApartment(item)
  }

  if (onlyVillas) {
    return isVilla(item)
  }

  return true
}

const shuffle = <T,>(input: T[]) => {
  const array = [...input]
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[array[index], array[randomIndex]] = [array[randomIndex], array[index]]
  }
  return array
}

export function useRoadAddressSearch(query: string, options: Options) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RoadAddressResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounceMs = options.debounceMs ?? 300

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }

    const controller = new AbortController()

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/road-address?query=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error('주소 검색에 실패했습니다.')
        }

        const payload: RawRoadResponse[] = await response.json()

        let filtered = payload.filter((item) => filterByOptions(item, options))

        if (options.randomize) {
          filtered = shuffle(filtered)
        }

        if (typeof options.limit === 'number') {
          filtered = filtered.slice(0, options.limit)
        }

        const mapped = filtered.map<RoadAddressResult>((item) => ({
          roadAddress: item.roadAddress,
          jibunAddress: item.jibunAddress ?? '',
          district: item.district ?? item.jibunAddress ?? '',
          buildingName: item.buildingName ?? '',
        }))

        setResults(mapped)
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return
        }
        setError((fetchError as Error).message)
      } finally {
        setIsLoading(false)
      }
    }, debounceMs)

    return () => {
      controller.abort()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, options, debounceMs])

  return useMemo(
    () => ({
      isLoading,
      error,
      results,
    }),
    [isLoading, error, results],
  )
}
