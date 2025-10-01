# Fire Detection API Bug Fix

## Problem
Line 334: `structure_confidence = float(np.max(smoke_pred)) * 100`

Error: "local variable 'smoke_pred' referenced before assignment"

## Root Cause
Using `smoke_pred` before it's defined. The structure confidence should use `structure_pred`.

## Fix

### WRONG CODE (Line 334):
```python
structure_pred = structure_model.predict(image, verbose=0)[0]
structure_result = STRUCTURE_CLASSES[np.argmax(structure_pred)]
structure_confidence = float(np.max(smoke_pred)) * 100  # ❌ BUG HERE
```

### CORRECT CODE:
```python
structure_pred = structure_model.predict(image, verbose=0)[0]
structure_result = STRUCTURE_CLASSES[np.argmax(structure_pred)]
structure_confidence = float(np.max(structure_pred)) * 100  # ✅ FIXED
```

## Where to Fix
1. Find line 334 in your Railway API code
2. Change `smoke_pred` to `structure_pred`
3. Redeploy to Railway

The same bug appears in two places:
- Line 334 (in `/predict` endpoint)
- Line 429 (in `/update_report` endpoint)

Fix both occurrences!
