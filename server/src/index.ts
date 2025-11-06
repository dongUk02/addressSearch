import cors from 'cors'
import express from 'express'
import type { Request, Response } from 'express'
import dotenv from 'dotenv'

dotenv.config()

const PORT = Number(process.env.PORT ?? 4000)
const ROAD_ADDRESS_API_KEY = process.env.ROAD_ADDRESS_API_KEY
const ROAD_ADDRESS_ENDPOINT =
  process.env.ROAD_ADDRESS_ENDPOINT ??
  'https://business.juso.go.kr/addrlink/addrLinkApi.do'

type JusoApiResponse = {
  results: {
    common: {
      errorCode: string
      errorMessage: string
      totalCount: string
      currentPage: string
    }
    juso?: Array<{
      roadAddr: string
      jibunAddr: string
      siNm: string
      sggNm: string
      emdNm: string
      bdNm: string
    }>
  }
}

type RoadAddressResponse = {
  roadAddress: string
  jibunAddress: string
  district: string
  buildingName: string
}

const fallbackAddresses: RoadAddressResponse[] = [
  {
    roadAddress: '경기도 의정부시 용민로 30',
    jibunAddress: '경기도 의정부시 민락동 802-2',
    district: '경기도 의정부시 민락동',
    buildingName: '의정부 민락 포스코더샵 아파트',
  },
  {
    roadAddress: '전라북도 전주시 덕진구 송천중앙로 120',
    jibunAddress: '전라북도 전주시 덕진구 송천동2가 790-6',
    district: '전라북도 전주시 덕진구 송천동2가',
    buildingName: '에코시티 더샵 4차 아파트',
  },
  {
    roadAddress: '전라북도 전주시 완산구 백제대로 417',
    jibunAddress: '전라북도 전주시 완산구 평화동1가 633-9',
    district: '전라북도 전주시 완산구 평화동1가',
    buildingName: '전주평화 한신휴플러스 빌라',
  },
]

const app = express()
app.use(cors())
app.use(express.json())

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/road-address', async (req: Request, res: Response) => {
  const query = (req.query.query as string | undefined)?.trim()

  if (!query) {
    return res.status(400).json({ message: 'query 파라미터를 입력해주세요.' })
  }

  if (!ROAD_ADDRESS_API_KEY) {
    return res.json(fallbackAddresses)
  }

  const params = new URLSearchParams({
    query,
    page: '1',
    size: '20',
  })

  const url = `${ROAD_ADDRESS_ENDPOINT}?${params.toString()}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`도로명 주소 API 요청 실패: ${response.status}`)
    }

    const data = (await response.json()) as JusoApiResponse
    const { common, juso } = data.results

    if (common.errorCode !== '0') {
      throw new Error(common.errorMessage || '도로명 주소 API 오류')
    }

    const payload: RoadAddressResponse[] =
      juso?.map((item) => ({
        roadAddress: item.roadAddr,
        jibunAddress: item.jibunAddr,
        district: `${item.siNm} ${item.sggNm} ${item.emdNm}`.trim(),
        buildingName: item.bdNm,
      })) ?? []

    res.json(payload)
  } catch (error) {
    console.error(error)
    res.status(502).json({
      message: '도로명 주소 API 연동에 실패했습니다.',
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
