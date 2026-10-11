const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/i;

export const isEmail = (value) => EMAIL.test(String(value || "").trim());
export const isUrl = (value) => URL.test(String(value || "").trim());
export const isFilled = (value) => {
  if (Array.isArray(value)) {
    return value.some((entry) => String(entry ?? "").trim().length > 0);
  }
  return String(value ?? "").trim().length > 0;
};

/**
 * Runs a `{ field: [predicate, message] }` rule map against a values object and
 * returns `{ field: message }` for whatever failed.
 */
export function validate(values, rules) {
  return Object.entries(rules).reduce((errors, [field, checks]) => {
    const list = Array.isArray(checks[0]) ? checks : [checks];
    for (const [predicate, message] of list) {
      if (!predicate(values[field], values)) {
        errors[field] = message;
        break;
      }
    }
    return errors;
  }, {});
}

export const firstErrorField = (errors) => Object.keys(errors)[0];
