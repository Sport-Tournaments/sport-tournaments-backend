# GitHub Issues Creation Script for Tournament Platform
# Run this in PowerShell in your repository directory

Write-Host "Creating GitHub issues..." -ForegroundColor Green

# Issue 1: Registration network error - no auto-scroll
gh issue create --title \"Registration error message not visible - requires manual scroll\" --body \"**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nWhen submitting registration form, if a network error occurs, the screen does not automatically scroll to show the error message at the top. Users must manually scroll up to see 'Network error'.`n`n**Steps to Reproduce:**`n1. Open registration form in Web/Safari`n2. Complete registration data`n3. Click 'Register'`n4. Network error appears at top`n5. Screen does not auto-scroll to error location`n`n**Expected Behavior:**`nPage should automatically scroll to error message when error occurs.\""

# Issue 2: Country dropdown not opening
gh issue create --title "Country selector dropdown not opening when typing" --body "**Platform:** All platforms`n**Priority:** High`n`n**Description:**`nIn country selection field, typing the first 2-3 letters does not trigger the dropdown list to open.`n`n**Steps to Reproduce:**`n1. Navigate to registration form`n2. Click on country selection field`n3. Type first 2-3 letters of country name`n4. Dropdown list does not appear`n`n**Expected Behavior:**`nDropdown should open and filter countries as user types."

# Issue 3: Account type selection UX improvement
gh issue create --title "Remove ACCOUNT TYPE from registration - move to dashboard" --body "**Type:** Enhancement`n**Priority:** Medium`n`n**Description:**`nRemove ACCOUNT TYPE selection from registration process. Users should create a single account and select their role (Participant/Club Manager or Tournament Organizer) from HOME/DASHBOARD after logging in.`n`n**Current Behavior:**`nUsers must choose account type during registration, potentially requiring multiple accounts.`n`n**Proposed Behavior:**`n- Single registration process`n- Account type selection available in HOME/DASHBOARD`n- Users can switch roles as needed"

# Issue 4: Login network error
gh issue create --title "Login fails with network error" --body "**Platform:** All platforms`n**Priority:** Critical`n`n**Description:**`nUsers cannot log in - network error occurs during login attempt.`n`n**Steps to Reproduce:**`n1. Navigate to LOGIN section`n2. Enter valid credentials`n3. Click Login`n4. Network error occurs`n`n**Expected Behavior:**`nUsers should be able to log in successfully with valid credentials."

# Issue 5: Forgot password not sending email
gh issue create --title "Forgot Password functionality not sending reset email" --body "**Platform:** All platforms`n**Priority:** Critical`n`n**Description:**`nThe 'Forgot Password' feature does not send password reset emails to users.`n`n**Steps to Reproduce:**`n1. Navigate to LOGIN section`n2. Click 'Forgot Password'`n3. Enter registered email address`n4. Submit`n5. No email is received`n`n**Expected Behavior:**`nPassword reset email should be sent to user's registered email address."

# Issue 6: Cannot login on Web/Safari
gh issue create --title "Unable to login on Web/Safari" --body "**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nUsers cannot log in when using Web/Safari browser.`n`n**Expected Behavior:**`nLogin should work across all browsers including Safari."

# Issue 7: Browse Tournaments network error
gh issue create --title "Browse Tournaments displays network error" --body "**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nClicking 'Browse Tournaments' from HOME PAGE navigates to correct section but shows error: 'An error occurred; Network error' with TRY AGAIN button.`n`n**Steps to Reproduce:**`n1. Go to HOME PAGE`n2. Click 'Browse Tournaments'`n3. Error message appears`n`n**Expected Behavior:**`nTournaments list should load successfully."

# Issue 8: Clubs section network error
gh issue create --title "Clubs section displays network error" --body "**Platform:** Web/Safari`n**Priority:** Critical`n`n**Description:**`nClicking 'Clubs' from HOME PAGE navigates to correct section but shows error: 'An error occurred; Network error' with TRY AGAIN button.`n`n**Steps to Reproduce:**`n1. Go to HOME PAGE`n2. Click 'Clubs'`n3. Error message appears`n`n**Expected Behavior:**`nClubs list should load successfully."

# Issue 9: Back button not working from login
gh issue create --title "BACK button not working when redirected to login" --body "**Platform:** All platforms`n**Priority:** High`n`n**Description:**`nWhen clicking 'Create Tournament' or 'Create Club' while not logged in, user is correctly redirected to LOGIN screen. However, the BACK button does not return user to previous screen.`n`n**Steps to Reproduce:**`n1. From Tournaments section, click '+ Create Tournament' (while not logged in)`n2. User is redirected to LOGIN (expected)`n3. Click BACK button`n4. Nothing happens`n`nSame issue occurs with '+ Create Club' button.`n`n**Expected Behavior:**`nBACK button should return user to the previous screen (Tournaments or Clubs section)."

# Issue 10: Bottom navigation 404 errors
gh issue create --title "Bottom navigation buttons showing 404 errors" --body "**Platform:** Web`n**Priority:** High`n`n**Description:**`nAll bottom navigation buttons except 'Tournaments' and 'Clubs' display 404 error.`n`n**Expected Behavior:**`nAll navigation buttons should link to valid pages or be removed/disabled if not yet implemented."

# Issue 11: Replace Europe with Worldwide
gh issue create --title "Replace 'Europe' with 'Worldwide' in footer" --body "**Platform:** Web`n**Priority:** Low`n**Type:** Enhancement`n`n**Description:**`nIn the bottom left corner of the web version, replace the word 'Europe' with 'Worldwide' to reflect broader platform scope.`n`n**Location:** Footer, bottom left`n**Current text:** Europe`n**Proposed text:** Worldwide"

# Issue 12: Session not persisting across browsers
gh issue create --title "Login credentials not shared between mobile and Chrome" --body "**Platform:** Google Chrome, Mobile`n**Priority:** Medium`n`n**Description:**`nGoogle Chrome does not recognize login credentials created on mobile device.`n`n**Steps to Reproduce:**`n1. Create account on mobile device`n2. Open Google Chrome on desktop`n3. Attempt to login with same credentials`n4. Credentials not recognized`n`n**Expected Behavior:**`nLogin credentials should work across all devices and browsers."

# Issue 13: Password requirements inconsistency
gh issue create --title "Password requirements changed - now requires special character" --body "**Platform:** All platforms`n**Priority:** Low`n**Type:** Enhancement`n`n**Description:**`nInitially, password creation did not require special characters. Now it does. This is acceptable but should be clearly communicated during registration.`n`n**Recommendation:**`nEnsure password requirements are clearly displayed during registration process."

# Issue 14: iOS Safari - hamburger menu not working
gh issue create --title "iOS Safari: Home Page menu (hamburger) not clickable when logged in" --body "**Platform:** iOS Safari`n**Priority:** High`n`n**Description:**`nOn Home Page, cannot click on Menu (3 lines, top left) even when logged in. However, the menu button next to 'SM' (top right) works correctly.`n`n**Steps to Reproduce:**`n1. Login on iOS Safari`n2. Go to Home Page`n3. Try to click hamburger menu (3 lines, top left)`n4. Nothing happens`n5. Click menu next to 'SM' (top right) - this works`n`n**Expected Behavior:**`nBoth menu buttons should work."

# Issue 15: Club logo upload fails
gh issue create --title "Create Club: Logo upload fails" --body "**Platform:** Google Chrome`n**Priority:** High`n`n**Description:**`nCannot upload club logo. Tested with 541 KB square image.`n`n**Steps to Reproduce:**`n1. Navigate to 'Create Club'`n2. Attempt to upload logo (541 KB, square format)`n3. Logo does not upload`n`n**Expected Behavior:**`nLogo should upload successfully. Consider adding clear requirements for:`n- Max file size`n- Accepted dimensions`n- Supported formats"

# Issue 16: Create Club fails
gh issue create --title "Create Club: 'Failed to create club' error" --body "**Platform:** Google Chrome`n**Priority:** Critical`n`n**Description:**`nAfter filling all club creation fields and clicking 'Create Club', error appears: 'Failed to create club'`n`n**Steps to Reproduce:**`n1. Fill in all required club creation fields`n2. Click 'Create Club'`n3. Error: 'Failed to create club'`n`n**Expected Behavior:**`nClub should be created successfully with proper validation messages if data is incorrect."

# Issue 17: Website field requires HTTPS
gh issue create --title "Website field only accepts URLs with https:// protocol" --body "**Platform:** Google Chrome`n**Priority:** Medium`n`n**Description:**`nThe 'Website' field only accepts URLs when entered with full https:// protocol.`n`n**Steps to Reproduce:**`n1. Navigate to club/tournament creation`n2. Try to enter website as 'example.com'`n3. Field rejects input`n4. Enter 'https://example.com'`n5. Field accepts input`n`n**Recommendation:**`n- Auto-prepend https:// if not provided`n- Show validation message explaining format required`n- Accept both http:// and https://"

# Issue 18: Calendar not opening on field click
gh issue create --title "Create Tournament: Calendar doesn't open when clicking date field" --body "**Platform:** Google Chrome`n**Priority:** Medium`n`n**Description:**`nWhen creating a tournament, clicking on 'Registration Opens' field does not open calendar. User must specifically click the calendar icon.`n`n**Affected Fields:**`n- Registration Opens`n- Registration Closes`n- Tournament Starts`n- Tournament End`n`n**Expected Behavior:**`nCalendar should open when clicking anywhere in the date field, not just the icon.`n`n**Note:** Age Category date fields work correctly - calendar opens on field click."

# Issue 19: Calendar not closing after date selection
gh issue create --title "Create Tournament: Calendar doesn't auto-close after date selection" --body "**Platform:** Google Chrome`n**Priority:** Medium`n`n**Description:**`nWhen selecting a date from calendar in 'Registration Opens', 'Registration Closes', 'Tournament Starts', or 'Tournament End' fields, the calendar remains open. User must click elsewhere to close it.`n`n**Steps to Reproduce:**`n1. Navigate to 'Create Tournament'`n2. Click on 'Registration Opens' calendar`n3. Select a date`n4. Calendar stays open`n5. Must click elsewhere to close`n`n**Expected Behavior:**`nCalendar should auto-close after date selection (like it does in Age Category date fields).`n`n**Note:** Age Category Start/End date fields work correctly - calendar closes automatically."

# Issue 20: Create Tournament 401 error
gh issue create --title "Create Tournament: Request failed with status code 401" --body "**Platform:** Google Chrome`n**Priority:** Critical`n`n**Description:**`nWhen creating a tournament with 2 age categories with minor differences, clicking 'Create Tournament' results in error: 'Request failed with status code 401'`n`n**Steps to Reproduce:**`n1. Fill in tournament creation form`n2. Add 2 age categories with slight variations`n3. Click 'Create Tournament'`n4. Error: 'Request failed with status code 401'`n`n**Expected Behavior:**`nTournament should be created successfully.`n`n**Note:** 401 typically indicates authentication issue - verify user session is valid."

# Issue 21: Teams/Groups calculation mismatch
gh issue create --title "Create Tournament: No automatic calculation between teams and groups" --body "**Platform:** All platforms`n**Priority:** Medium`n**Type:** Enhancement`n`n**Description:**`nThere's no correlation between number of teams and number of groups. When selecting 32 teams with 4 teams per group, 'Number of groups' should automatically calculate to 8.`n`n**Example:**`n- Selected: 32 teams`n- Selected: 4 teams per group`n- Expected: Number of groups = 8 (auto-calculated)`n`n**Recommendation:**`n1. Auto-calculate number of groups based on: (Total teams) / (Teams per group)`n2. OR: Allow manual input for all three fields with validation warning if numbers don't match"

# Issue 22: Draw simulation feature request
gh issue create --title "Feature Request: Group draw simulation tool for organizers" --body "**Type:** Feature Request`n**Priority:** Medium`n`n**Description:**`nOrganizers should be able to simulate team placement in groups using a pot-based draw system after registration closes.`n`n**Proposed Workflow:**`n1. After registration closes, organizer assigns teams to pots:`n   - Pot 1: Strongest teams`n   - Pot 2: Second tier teams`n   - Pot 3: Third tier teams`n   - Pot 4: Weakest teams`n2. Platform automatically creates groups by drawing one team from each pot into each group`n`n**Example (16 teams, 4 groups of 4):**`n- Pot 1: 4 teams (level 1)`n- Pot 2: 4 teams (level 2)`n- Pot 3: 4 teams (level 3)`n- Pot 4: 4 teams (level 4)`n`n**Result:**`n- Group A: Team from Pot 1, 2, 3, 4`n- Group B: Team from Pot 1, 2, 3, 4`n- Group C: Team from Pot 1, 2, 3, 4`n- Group D: Team from Pot 1, 2, 3, 4`n`n**Benefits:**`n- Balanced groups`n- Fair draw system`n- Professional tournament organization`n- Prevents strongest teams in same group"

Write-Host "`nAll issues created successfully!" -ForegroundColor Green