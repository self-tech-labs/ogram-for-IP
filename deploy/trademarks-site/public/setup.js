const pluginUrl = document.querySelector('.setup-action--primary').href;
const setupPrompt = `Help me install Swiss Trademark Deposit from ${pluginUrl}. Once it is connected, ask for my proposed mark and business activities. Then use its read-only tools to prepare Nice classes, goods and services wording, and a plan for a live clearance search. Do not claim that an application was filed or a live search was completed.`;

const copyButton = document.getElementById('copy-setup-prompt');
const feedback = document.getElementById('setup-feedback');
const originalLabel = copyButton.innerHTML;
let resetTimer;

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(setupPrompt);
    copyButton.innerHTML = 'Prompt copied <span aria-hidden="true">✓</span>';
    feedback.textContent = 'Paste it into your agent.';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copyButton.innerHTML = originalLabel;
      feedback.textContent = '';
    }, 4000);
  } catch {
    feedback.textContent = `Copy this prompt: ${setupPrompt}`;
  }
});
