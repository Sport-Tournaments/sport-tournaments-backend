# ISSUE #1 ROOT CAUSE ANALYSIS

## Scenario 1: 7 teams with 2 pots - 400 Bad Request Error

### Root Cause Found
**File**: `src/modules/groups/services/pot-draw.service.ts`
**Method**: `executePotBasedDraw()` (lines 116-224)

### Problematic Validations:

#### Validation 1 (Line 139-144):
```typescript
if (totalTeams % dto.numberOfGroups !== 0) {
  throw new BadRequestException(
    `Total teams (${totalTeams}) must be divisible by number of groups (${dto.numberOfGroups})`,
  );
}
```
**Issue**: Rejects 7 teams with 2 groups (7 % 2 = 1)

#### Validation 2 (Line 188-193):
```typescript
if (potTeams.length > 0 && potTeams.length !== dto.numberOfGroups) {
  throw new BadRequestException(
    `Pot ${potNum} has ${potTeams.length} teams but needs exactly ${dto.numberOfGroups} teams`,
  );
}
```
**Issue**: Each pot must have EXACTLY numberOfGroups teams - impossible with uneven distributions

### Fix Required
1. Remove or modify divisibility check
2. Implement flexible distribution logic (like snake draft)
3. Allow uneven pots (e.g., Pot 1: 4 teams, Pot 2: 3 teams)
4. Distribute to groups regardless of even pot sizes

### Expected Behavior After Fix
- 7 teams, 2 groups → 2 groups of 3 and 4 teams respectively
- Should create 2 groups successfully
- Teams distributed from pots in round-robin fashion