import { useState } from 'react'
import { DepartureInput } from './components/DepartureInput'
import { useRoadAddressSearch } from './hooks/useRoadAddressSearch'
import type { RoadAddressResult } from './hooks/useRoadAddressSearch'
import './App.css'

const DEFAULT_DEPARTURE = '경기도 의정부시'

function App() {
  const [departure, setDeparture] = useState(DEFAULT_DEPARTURE)
  const [arrivalInput, setArrivalInput] = useState('')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [hasAttemptedSearch, setHasAttemptedSearch] = useState(false)

  const {
    results,
    openSearch,
    clearResults,
    error,
    clearError,
    isReady,
    status,
  } = useRoadAddressSearch({ limit: 10 })

  const copyText = (item: RoadAddressResult) => {
    const label = item.buildingName
      ? `${item.roadAddress} (${item.buildingName})`
      : item.roadAddress
    const key = `${item.roadAddress}-${item.buildingName}`

    const applyCopiedState = () => {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 2000)
    }

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea')
      textarea.value = label
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (successful) {
        applyCopiedState()
      } else {
        alert('복사에 실패했습니다. 수동으로 복사해주세요.')
      }
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(label).then(applyCopiedState).catch(fallbackCopy)
    } else {
      fallbackCopy()
    }
  }

  const handleSearch = () => {
    setHasAttemptedSearch(true)
    clearError()
    openSearch(arrivalInput.trim())
  }

  const handleReset = () => {
    setArrivalInput('')
    setHasAttemptedSearch(false)
    clearResults()
    clearError()
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>탁송 주소 검색</h1>
        <p>출발지를 확인하고 다음 우편번호 서비스를 통해 공동주택 도착지를 검색하세요.</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>출발지</h2>
          <DepartureInput value={departure} onChange={setDeparture} />
        </section>

        <section className="panel">
          <h2>도착지 검색</h2>
          <form
            className="arrival-form"
            onSubmit={(event) => {
              event.preventDefault()
              handleSearch()
            }}
          >
            <label className="field">
              <span className="field__label">도착지 주소</span>
              <input
                className="field__input"
                type="text"
                value={arrivalInput}
                placeholder="예: 전북 전주시"
                onChange={(event) => setArrivalInput(event.target.value)}
              />
            </label>
            <div className="arrival-form__actions">
              <button
                className="button button--primary"
                type="submit"
                disabled={!arrivalInput.trim() || status === 'loading' || status === 'error'}
              >
                검색
              </button>
              <button className="button" type="button" onClick={handleReset}>
                초기화
              </button>
            </div>
            <p className="helper-text">
              예: &ldquo;전북 전주시&rdquo;처럼 시·구 단위까지 입력하면 공동주택(아파트/빌라) 주소만 선택할 수 있습니다.
            </p>
            {!isReady && status !== 'error' && (
              <p className="helper-text">주소 검색 스크립트를 불러오는 중입니다...</p>
            )}
          </form>
        </section>

        <section className="panel panel--wide">
          <h2>공동주택 주소 결과</h2>
          {error && <p className="status status--error">{error}</p>}
          {hasAttemptedSearch && results.length === 0 && !error && (
            <p className="status">조건에 맞는 공동주택 주소를 아직 선택하지 않았습니다.</p>
          )}
          {results.length > 0 && (
            <ul className="results">
              {results.map((item) => {
                const key = `${item.roadAddress}-${item.buildingName}`
                return (
                  <li key={key} className="result">
                    <div className="result__content">
                      <p className="result__title">{item.roadAddress}</p>
                      <p className="result__meta">
                        {item.buildingName ? `${item.buildingName} · ` : ''}
                        {item.district || item.jibunAddress}
                      </p>
                    </div>
                    <div className="result__actions">
                      <button className="button button--ghost" type="button" onClick={() => copyText(item)}>
                        복사
                      </button>
                      {copiedKey === key && <span className="copy-feedback">복사됨</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
