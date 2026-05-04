import { execSync } from 'child_process';

async function run() {
  try {
    console.log('--- Step 1: Generating Screenshots ---');
    execSync('npm run screenshots', { stdio: 'inherit' });

    console.log('\n--- Step 2: Committing Changes ---');
    execSync('git add screenshots/*.png', { stdio: 'inherit' });
    
    // Check if there are changes to commit
    const status = execSync('git status --porcelain screenshots/').toString();
    if (status) {
      execSync('git commit -m "docs: update application screenshots"', { stdio: 'inherit' });
      
      console.log('\n--- Step 3: Pushing to GitHub ---');
      execSync('git push', { stdio: 'inherit' });
      console.log('\n✅ All done! Screenshots updated and pushed.');
    } else {
      console.log('\nℹ️ No changes detected in screenshots. Skipping commit/push.');
    }
  } catch (err) {
    console.error('\n❌ Error during auto-update:', err.message);
    process.exit(1);
  }
}

run();
