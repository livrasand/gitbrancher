const ora = require('ora');
const chalk = require('chalk');

/**
 * Clase envoltorio para el spinner de la CLI.
 * Maneja la detección de TTY y entornos de CI para degradarse elegantemente.
 */
class Spinner {
  constructor(text) {
    this.text = text;
    this.isInteractive = process.stdout.isTTY && !process.env.CI;

    if (this.isInteractive) {
      this.spinner = ora({
        text: this.text,
        color: 'cyan',
        spinner: 'dots',
      });
    }
  }

  /**
   * Inicia el spinner o imprime un mensaje informativo si no es interactivo.
   */
  start() {
    if (this.isInteractive) {
      this.spinner.start();
    } else {
      console.log(chalk.cyan(`[INFO] ${this.text}...`));
    }
    return this;
  }

  /**
   * Detiene el spinner con éxito.
   * @param {string} text - Mensaje opcional de éxito.
   */
  succeed(text) {
    if (this.isInteractive) {
      this.spinner.succeed(text || this.text);
    } else {
      console.log(chalk.green(`[SUCCESS] ${text || this.text}`));
    }
    return this;
  }

  /**
   * Detiene el spinner con error.
   * @param {string} text - Mensaje opcional de error.
   */
  fail(text) {
    if (this.isInteractive) {
      this.spinner.fail(text || this.text);
    } else {
      console.error(chalk.red(`[ERROR] ${text || this.text}`));
    }
    return this;
  }

  /**
   * Detiene el spinner con información.
   * @param {string} text - Mensaje opcional informativo.
   */
  info(text) {
    if (this.isInteractive) {
      this.spinner.info(text || this.text);
    } else {
      console.log(chalk.blue(`[INFO] ${text || this.text}`));
    }
    return this;
  }

  /**
   * Detiene el spinner sin dejar rastro (limpia la línea).
   */
  stop() {
    if (this.isInteractive) {
      this.spinner.stop();
    }
  }
}

/**
 * Crea e inicia una instancia de Spinner.
 * @param {string} text - Texto a mostrar.
 * @returns {Spinner} Instancia de Spinner iniciada.
 */
function createSpinner(text) {
  return new Spinner(text).start();
}

module.exports = {
  Spinner,
  createSpinner,
};
