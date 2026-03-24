const SelectField = ({ label, value, onChange, options, disabled = false }) => {
  return (
    <div className="form-field">
      <label className="form-label">
        {label}
      </label>

      <select
        className="form-input form-select"
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {options.map((opt, index) => (
          <option key={index} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectField;
