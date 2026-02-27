const ora = require('ora');

/**
 * Utility to manage visual progress indicators (spinners).
 * Ensures they are only visible in interactive terminal sessions.
 */
class Spinner {
  constructor(message) {
    this.isInteractive = process.stdout.isTTY && !process.env.CI;
    this.message = message;
    this.spinner = null;

    if (this.isInteractive) {
      this.spinner = ora(message);
    }
  }

  /**
   * Starts the spinner.
   * @returns {Spinner}
   */
  start() {
    if (this.spinner) {
      this.spinner.start();
    } else {
      console.log(this.message);
    }
    return this;
  }

  /**
   * Stops the spinner with a success state.
   * @param {string} [message] - Optional success message.
   */
  succeed(message) {
    if (this.spinner) {
      this.spinner.succeed(message);
    } else if (message) {
      console.log(message);
    }
  }

  /**
   * Stops the spinner with a failure state.
   * @param {string} [message] - Optional failure message.
   */
  fail(message) {
    if (this.spinner) {
      this.spinner.fail(message);
    } else if (message) {
      console.error(message);
    }
  }

  /**
   * Stops the spinner with an info state.
   * @param {string} [message] - Optional info message.
   */
  info(message) {
    if (this.spinner) {
      this.spinner.info(message);
    } else if (message) {
      console.log(message);
    }
  }

  /**
   * Updates the spinner text.
   * @param {string} message
   */
  updateText(message) {
    this.message = message;
    if (this.spinner) {
      this.spinner.text = message;
    } else {
      console.log(message);
    }
  }
}

/**
 * Creates and starts a new spinner.
 * @param {string} message
 * @returns {Spinner}
 */
function createSpinner(message) {
  return new Spinner(message).start();
}

module.exports = {
  Spinner,
  createSpinner
};
