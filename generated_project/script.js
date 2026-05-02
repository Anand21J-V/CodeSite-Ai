// script.js
// Simple calculator logic and UI integration

/**
 * Calculator class encapsulating core arithmetic logic.
 */
class Calculator {
  constructor() {
    this.currentInput = ""; // string representation of the number being entered
    this.previousValue = null; // numeric value stored before an operator is chosen
    this.operator = null; // '+', '-', '*', '/'
    this.result = null; // last computed result
  }

  /**
   * Append a digit or decimal point to the current input.
   * @param {string} digit - One of '0'..'9' or '.'
   */
  appendDigit(digit) {
    if (digit === ".") {
      // Prevent multiple decimal points
      if (this.currentInput.includes('.')) return;
      // If input is empty, start with "0."
      if (this.currentInput === "") {
        this.currentInput = "0.";
        return;
      }
      this.currentInput += '.';
      return;
    }

    // digit is 0-9
    if (digit < '0' || digit > '9') return; // safety

    // Avoid leading zeros (e.g., "00"), but allow "0" if it's the only digit or before a decimal point
    if (this.currentInput === "0") {
      // Replace leading zero unless a decimal point follows
      this.currentInput = digit;
    } else {
      this.currentInput += digit;
    }
  }

  /**
   * Set the operator for the next calculation.
   * If there is a pending operation, compute the intermediate result first.
   * @param {string} op - One of '+', '-', '*', '/'
   */
  setOperator(op) {
    if (!['+', '-', '*', '/'].includes(op)) return;
    // If we already have a previous value and an operator, compute first
    if (this.previousValue !== null && this.operator !== null && this.currentInput !== "") {
      this.compute();
    }
    // Move current input to previousValue if we have something typed
    if (this.currentInput !== "") {
      this.previousValue = parseFloat(this.currentInput);
      this.currentInput = "";
    }
    this.operator = op;
  }

  /**
   * Perform the calculation based on the stored operator.
   * Throws an Error on division by zero.
   * @returns {number} The computed result.
   */
  compute() {
    if (this.operator === null) {
      // Nothing to compute – just return the current number
      const val = this.currentInput !== "" ? parseFloat(this.currentInput) : this.previousValue;
      this.result = val;
      this._resetAfterCompute(val);
      return val;
    }

    const left = this.previousValue !== null ? this.previousValue : 0;
    const right = this.currentInput !== "" ? parseFloat(this.currentInput) : left; // if second operand missing, reuse left

    let res;
    switch (this.operator) {
      case '+':
        res = left + right;
        break;
      case '-':
        res = left - right;
        break;
      case '*':
        res = left * right;
        break;
      case '/':
        if (right === 0) {
          throw new Error('Division by zero');
        }
        res = left / right;
        break;
      default:
        res = NaN;
    }
    this.result = res;
    this._resetAfterCompute(res);
    return res;
  }

  /**
   * Internal helper to reset state after a successful computation.
   * @param {number} value - The result to display next.
   */
  _resetAfterCompute(value) {
    // Show the result as the new current input for further chaining
    this.currentInput = value.toString();
    this.previousValue = null;
    this.operator = null;
  }

  /**
   * Clear all fields to start a fresh calculation.
   */
  clear() {
    this.currentInput = "";
    this.previousValue = null;
    this.operator = null;
    this.result = null;
  }

  /**
   * Remove the last character from the current input.
   */
  backspace() {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  /**
   * Get the string that should be shown on the calculator display.
   * @returns {string}
   */
  getDisplay() {
    if (this.currentInput !== "") {
      return this.currentInput;
    }
    if (this.previousValue !== null) {
      return this.previousValue.toString();
    }
    return "0";
  }
}

// UI integration – runs when the script is loaded
(function () {
  const displayEl = document.getElementById('display');
  const buttonContainer = document.querySelector('.buttons');

  const calc = new Calculator();
  // expose for debugging
  window.calc = calc;

  const updateDisplay = () => {
    displayEl.textContent = calc.getDisplay();
  };

  const handleButton = (action, value) => {
    switch (action) {
      case 'digit':
        calc.appendDigit(value);
        break;
      case 'operator':
        calc.setOperator(value);
        break;
      case 'equals':
        try {
          calc.compute();
        } catch (err) {
          alert(err.message);
          calc.clear();
        }
        break;
      case 'clear':
        calc.clear();
        break;
      case 'backspace':
        calc.backspace();
        break;
      default:
        // unknown action – ignore
        break;
    }
    updateDisplay();
  };

  // Click handling via event delegation
  buttonContainer.addEventListener('click', (e) => {
    const target = e.target;
    if (!target.matches('button')) return;
    const action = target.dataset.action;
    const value = target.dataset.value;
    handleButton(action, value);
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    // Map keys to actions
    if (key >= '0' && key <= '9') {
      e.preventDefault();
      handleButton('digit', key);
    } else if (key === '.' || key === ',') { // allow comma as decimal in some locales
      e.preventDefault();
      handleButton('digit', '.');
    } else if (['+', '-', '*', '/'].includes(key)) {
      e.preventDefault();
      handleButton('operator', key);
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleButton('equals');
    } else if (key === 'Backspace') {
      e.preventDefault();
      handleButton('backspace');
    } else if (key === 'Escape') {
      e.preventDefault();
      handleButton('clear');
    } else if (key.toLowerCase() === 'c') {
      e.preventDefault();
      handleButton('clear');
    }
    // other keys are ignored
  });

  // Initial display
  updateDisplay();
})();
