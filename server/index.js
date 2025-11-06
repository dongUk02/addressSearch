const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 4000;
const DATA_GO_KR_SERVICE_KEY = 'u18VVOusdias3cWBSDZJu8Q7KuqhxvbfS9%2Fo042FeTriBwHxKZ19HEuIm47KQJIRTwW5D6IQ97sJ0wSaxJCfoQ%3D%3D';

const SIGUNGU_API_PATH = 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList';

const APT_LIST_SERVICE_PATH = 'https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3';

function getServiceKey() {
  try {
    return decodeURIComponent(DATA_GO_KR_SERVICE_KEY);
  } catch (error) {
    return DATA_GO_KR_SERVICE_KEY;
  }
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (_error) {
    return '';
  }
}
const PUBLIC_DIR = path.join(__dirname, '../public');

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*'
  })
);

app.use(express.static(PUBLIC_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/apartments', async (req, res) => {
  const { sidoName = '', sigunguName = '', keyword = '', max = '1000' } = req.query;
  const trimmedSido = String(sidoName).trim();
  const trimmedSigungu = String(sigunguName).trim();
  const searchName = [trimmedSido, trimmedSigungu].filter(Boolean).join(' ').trim();
  const limit = Math.min(Math.max(parseInt(max, 10) || 1000, 1), 1000);

  if (!trimmedSido || !trimmedSigungu) {
    return res
      .status(400)
      .json({ message: 'sidoName과 sigunguName은 필수 파라미터입니다.' });
  }

  try {
    const sigunguRows = await fetchSigunguRows(searchName);
    const sigunguInfo = extractSigunguInfo(sigunguRows, searchName);

    console.log(sigunguRows);
    console.log(sigunguInfo);
    if (!sigunguInfo) {
      return res
        .status(404)
        .json({ message: '시·군·구 코드를 찾을 수 없습니다.', query: searchName });
    }

    const apartmentResponse = await fetchApartments({
      sigunguCode: sigunguInfo.sigunguCode,
      limit
    });

    res.json({
      query: searchName,
      sigunguCode: sigunguInfo.sigunguCode,
      sigunguName: sigunguInfo.sigunguName,
      keyword: keyword ? String(keyword) : '',
      total: apartmentResponse.total ?? apartmentResponse.items.length,
      items: apartmentResponse.items,
      raw: apartmentResponse.raw
    });
  } catch (error) {
    console.error(
      '[Apartments API] 처리 실패',
      JSON.stringify({
        searchName,
        sido: trimmedSido,
        sigungu: trimmedSigungu,
        keyword: keyword ? String(keyword) : '',
        error: error.message
      })
    );
    res
      .status(502)
      .json({ message: '공공데이터 포털 조회에 실패했습니다.', detail: error.message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function fetchStanReginRows(extraParams = {}) {
  const params = new URLSearchParams({
    pageNo: '1',
    numOfRows: '1000',
    type: 'json'
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.set(key, String(value));
  });

  const serviceKeyParam = `serviceKey=${DATA_GO_KR_SERVICE_KEY}`;
  const requestUrl = `${SIGUNGU_API_PATH}?${params.toString()}&${serviceKeyParam}`;
  if (process.env.DEBUG_APIS === 'true') {
    console.debug('[StanReginCd] Request params', Array.from(params.keys()));
  }

  const response = await fetch(requestUrl);


  if (response.status !== 200) {
    const errorText = await safeReadText(response);
    console.error(
      '[StanReginCd] 요청 실패',
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        requestUrl: requestUrl,
        responseSnippet: errorText.slice(0, 2000)
      })
    );
    throw new Error(`행정구역 API 요청 실패 (${response.status})`);
  }

  const data = await response.json();
  const rows = data.StanReginCd[1].row ?? [];
  return Array.isArray(rows) ? rows : [rows].filter(Boolean);
}

async function fetchSigunguRows(query) {
  return fetchStanReginRows({
    locatadd_nm: query
  });
}

function extractSigunguInfo(rows, query) {
  if (!rows.length) {
    return null;
  }

  const normalizedQuery = query.replace(/\s+/g, '');

  const topLevel =
    rows.find(
      (row) =>
        row?.umd_cd === '000' &&
        row?.ri_cd === '00' &&
        typeof row?.locatadd_nm === 'string' &&
        row.locatadd_nm.replace(/\s+/g, '').includes(normalizedQuery)
    ) ||
    rows.find((row) => row?.umd_cd === '000' && row?.ri_cd === '00') ||
    rows.find((row) => row?.sgg_cd && row.sgg_cd !== '000');

  if (!topLevel) {
    return null;
  }

  const sigunguCode = `${topLevel.sido_cd || ''}${topLevel.sgg_cd || ''}`.padEnd(5, '0');
  const sigunguName = topLevel.locatadd_nm || query;

  const bjdongCodes = rows
    .map((row) => String(row?.locatjijuk_cd || '').slice(5, 10))
    .filter((code) => code && code !== '00000');

  return { sigunguCode, sigunguName, bjdongCodes };
}

async function fetchApartments({ sigunguCode, limit }) {
  if (!sigunguCode) {
    return { items: [], total: 0, raw: null };
  }

  const params = new URLSearchParams({
    sigunguCode,
    pageNo: '1',
    numOfRows: String(Math.min(Math.max(limit || 100, 1), 1000)),
    _type: 'json'
  });

  const serviceKeyParam = `serviceKey=${DATA_GO_KR_SERVICE_KEY}`;
  const requestUrl = `${APT_LIST_SERVICE_PATH}?${params.toString()}&${serviceKeyParam}`;
  if (process.env.DEBUG_APIS === 'true') {
    console.debug('[AptListService3] Request params', Array.from(params.keys()));
  }

  const response = await fetch(requestUrl);


  if (!response.ok) {
    const errorText = await safeReadText(response);
    console.error(
      '[AptListService3] 요청 실패',
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        requestUrl: requestUrl,
        responseSnippet: errorText.slice(0, 2000)
      })
    );
    throw new Error(`공동주택 정보 API 요청 실패 (${response.status})`);
  }

  const data = await response.json();
  const items = extractApartmentItems(data);

  return {
    items,
    total: data?.response?.body?.totalCount ?? items.length,
    raw: data
  };
}

function extractApartmentItems(payload) {
  const bodyItems = payload?.response?.body?.items;

  let candidates;
  if (Array.isArray(bodyItems)) {
    candidates = bodyItems;
  } else if (Array.isArray(bodyItems?.item)) {
    candidates = bodyItems.item;
  } else if (bodyItems && typeof bodyItems === 'object') {
    candidates = [bodyItems];
  } else if (Array.isArray(payload?.items)) {
    candidates = payload.items;
  } else if (Array.isArray(payload?.data)) {
    candidates = payload.data;
  } else {
    candidates = [];
  }

  return candidates
    .filter(Boolean)
    .map((item) => {
      const buildingName =
        item?.aptNm ||
        item?.bldNm ||
        item?.kaptName ||
        item?.buildingName ||
        item?.aptName ||
        '';

      const roadAddress =
        item?.rdnmAdr ||
        item?.roadNm ||
        item?.roadAddress ||
        item?.roadAddr ||
        item?.roadAddressPart ||
        '';

      const jibunAddress =
        item?.jibun ||
        item?.lndnAddress ||
        item?.jibunAddress ||
        item?.jibunAdr ||
        item?.landAddress ||
        '';

      const locationParts = [item?.as1, item?.as2, item?.as3, item?.as4]
        .map((part) => (part ? String(part).trim() : ''))
        .filter(Boolean);

      const locationAddress = locationParts.join(' ');

      const postalCode =
        item?.zip ||
        item?.zipNo ||
        item?.zi ||
        item?.postalCode ||
        item?.postCode ||
        '';

      return {
        buildingName,
        roadAddress,
        jibunAddress,
        detailAddress: roadAddress || jibunAddress || locationAddress,
        postalCode,
        primaryAddress:
          roadAddress || jibunAddress || locationAddress || buildingName,
        apartment: true,
        original: item
      };
    });
}

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
