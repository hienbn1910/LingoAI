import { languages } from "../constants/languages";

function LanguageSelect({
  id,
  label,
  value,
  onChange,
  allowAuto = false,
  disabled = false,
}) {
  return (
    <div className="language-select">
      <label htmlFor={id}>{label}</label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {allowAuto && <option value="auto">Tự động phát hiện</option>}

        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSelect;
