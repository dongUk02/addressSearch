type DepartureInputProps = {
  value: string
  onChange: (value: string) => void
}

export function DepartureInput({ value, onChange }: DepartureInputProps) {
  return (
    <div className="departure-form">
      <label className="field">
        <span className="field__label">출발지 주소</span>
        <input
          className="field__input"
          type="text"
          placeholder="예: 경기도 의정부시 민락동"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="helper-text">기본값은 의정부시이며 언제든지 수정할 수 있습니다.</p>
      <div className="departure-form__actions">
        <button className="button" type="button" onClick={() => onChange('경기도 의정부시')}>
          기본값으로 재설정
        </button>
      </div>
    </div>
  )
}
