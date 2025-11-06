// 환경설정 기본값 (운영/개발 API 키가 없을 경우 빈 값으로 유지)
window.appConfig = {
  api: {
    backendBaseUrl: 'http://localhost:4000',
    dataGoKr: {
      developmentServiceKey: 'u18VVOusdias3cWBSDZJu8Q7KuqhxvbfS9%2Fo042FeTriBwHxKZ19HEuIm47KQJIRTwW5D6IQ97sJ0wSaxJCfoQ%3D%3D',
      productionServiceKey: 'u18VVOusdias3cWBSDZJu8Q7KuqhxvbfS9%2Fo042FeTriBwHxKZ19HEuIm47KQJIRTwW5D6IQ97sJ0wSaxJCfoQ%3D%3D'
    }
  },
  features: {
    // 검색 모드를 변경하려면 'dataset' 또는 'postcode' 로 설정합니다.
    searchMode: 'dataset',
    sigunguApiPath: 'https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList',
    aptListServicePath: 'https://apis.data.go.kr/1613000/AptListService3',
    apartmentDatasetPath: 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV4'
  }
};
