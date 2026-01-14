# GitHub Issues Creation Script for Tournament Platform - BACKEND
# Run this in PowerShell in your backend repository directory

Write-Host "Creating Backend GitHub issues..." -ForegroundColor Green

# Issue 1: Login network error
gh issue create --title "Login fails with network error" --body "**Platform:** All platforms`n**Priority:** Critical`n`n**Description:**`nUsers cannot log in - network error occurs during login attempt.`n`n**Steps to Reproduce:**`n1. Navigate to LOGIN section`n2. Enter valid credentials`n3. Click Login`n4. Network error occurs`n`n**Expected Behavior:**`nUsers should be able to log in successfully with valid credentials."

# Issue 2: Forgot password not sending email
gh issue create --title "Forgot Password functionality not sending reset email" --body "**Platform:** All platforms`n**Priority:** Critical`n`n**Description:**`nThe 'Forgot Password' feature does not send password reset emails to users.`n`n**Steps to Reproduce:**`n1. Navigate to LOGIN section`n2. Click 'Forgot Password'`n3. Enter registered email address`n4. Submit`n5. No email is received`n`n**Expected Behavior:**`nPassword reset email should be sent to user's registered email address."

# Issue 3: Browse Tournaments network error
gh issue create --title "Browse Tournaments displays network error" --body "**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nClicking 'Browse Tournaments' from HOME PAGE navigates to correct section but shows error: 'An error occurred; Network error' with TRY AGAIN button.`n`n**Steps to Reproduce:**`n1. Go to HOME PAGE`n2. Click 'Browse Tournaments'`n3. Error message appears`n`n**Expected Behavior:**`nTournaments list should load successfully."

# Issue 4: Clubs section network error
gh issue create --title "Clubs section displays network error" --body "**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nClicking 'Clubs' from HOME PAGE navigates to correct section but shows error: 'An error occurred; Network error' with TRY AGAIN button.`n`n**Steps to Reproduce:**`n1. Go to HOME PAGE`n2. Click 'Clubs'`n3. Error message appears`n`n**Expected Behavior:**`nClubs list should load successfully."

# Issue 5: Session not persisting across browsers
gh issue create --title "Login credentials not shared between mobile and Chrome" --body "**Platform:** Google Chrome, Mobile`n**Priority:** Medium`n`n**Description:**`nGoogle Chrome does not recognize login credentials created on mobile device.`n`n**Steps to Reproduce:**`n1. Create account on mobile device`n2. Open Google Chrome on desktop`n3. Attempt to login with same credentials`n4. Credentials not recognized`n`n**Expected Behavior:**`nLogin credentials should work across all devices and browsers."

# Issue 6: Create Club fails
gh issue create --title "Create Club: 'Failed to create club' error" --body "**Platform:** Google Chrome`n**Priority:** Critical`n`n**Description:**`nAfter filling all club creation fields and clicking 'Create Club', error appears: 'Failed to create club'`n`n**Steps to Reproduce:**`n1. Fill in all required club creation fields`n2. Click 'Create Club'`n3. Error: 'Failed to create club'`n`n**Expected Behavior:**`nClub should be created successfully with proper validation messages if data is incorrect."

# Issue 7: Create Tournament 401 error
gh issue create --title "Create Tournament: Request failed with status code 401" --body "**Platform:** Google Chrome`n**Priority:** Critical`n`n**Description:**`nWhen creating a tournament with 2 age categories with minor differences, clicking 'Create Tournament' results in error: 'Request failed with status code 401'`n`n**Steps to Reproduce:**`n1. Fill in tournament creation form`n2. Add 2 age categories with slight variations`n3. Click 'Create Tournament'`n4. Error: 'Request failed with status code 401'`n`n**Expected Behavior:**`nTournament should be created successfully.`n`n**Note:** 401 typically indicates authentication issue - verify user session is valid."

# Issue 8: Feature Request: Group draw simulation tool for organizers
gh issue create --title "Feature Request: Group draw simulation tool for organizers" --body "**Type:** Feature Request`n**Priority:** Medium`n`n**Description:**`nOrganizers should be able to simulate team placement in groups using a pot-based draw system after registration closes.`n`n**Proposed Workflow:**`n1. After registration closes, organizer assigns teams to pots:`n   - Pot 1: Strongest teams`n   - Pot 2: Second tier teams`n   - Pot 3: Third tier teams`n   - Pot 4: Weakest teams`n2. Platform automatically creates groups by drawing one team from each pot into each group`n`n**Example (16 teams, 4 groups of 4):**`n- Pot 1: 4 teams (level 1)`n- Pot 2: 4 teams (level 2)`n- Pot 3: 4 teams (level 3)`n- Pot 4: 4 teams (level 4)`n`n**Result:**`n- Group A: Team from Pot 1, 2, 3, 4`n- Group B: Team from Pot 1, 2, 3, 4`n- Group C: Team from Pot 1, 2, 3, 4`n- Group D: Team from Pot 1, 2, 3, 4`n`n**Benefits:**`n- Balanced groups`n- Fair draw system`n- Professional tournament organization`n- Prevents strongest teams in same group"

Write-Host "`nAll backend issues created successfully!" -ForegroundColor Green
