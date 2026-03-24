const PrimaryButton = ({ text, onClick, disabled = false }) => {
  return (
    <button
      className="primary-button"
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </button>
  );
};

export default PrimaryButton;
