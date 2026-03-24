const InputField = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="form-field">
      <label className="form-label">
        {label}
      </label>

      <input
        className="form-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
};

export default InputField;
