const chalk = require('chalk');
const { getCredits } = require('../../utils/auth');

async function creditsCommand() {
  console.log(chalk.cyan('Créditos AI disponibles\n'));

  const credits = await getCredits();

  if (!credits) {
    console.log(chalk.red('Debes iniciar sesión para ver tus créditos.'));
    console.log(chalk.yellow('Ejecuta "gitbrancher login" para autenticarte.'));
    return;
  }

  const remaining = credits.credits_limit - credits.credits_used;
  const planName = credits.plan === 'free' ? 'Free' : 'Pro';

  console.log(`🧠 AI credits: ${remaining} / ${credits.credits_limit} (Plan ${planName})`);

  if (remaining === 0) {
    console.log(chalk.red('\n❌ Límite de créditos alcanzado.'));
    if (credits.plan === 'free') {
      console.log(chalk.yellow('Actualiza a Pro para 500 créditos AI / mes.'));
    }
  }
}

module.exports = creditsCommand;
