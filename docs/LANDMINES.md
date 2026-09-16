# Missouri State Lacrosse - Code Landmines

Traps that don't show up in a diff, don't fail the build, and have already caused a
real production incident. Read before touching auth/account-linking code.

Last updated: 2026-09-16.

---

## 1. A player's stored Firebase UID can go stale and get permanently stuck

`Player.user_uid`, `PlayerProfile.firebase_uid`, and `UserAccount.firebase_uid` all
store a Firebase Auth UID for the same person, written independently by different
code paths. If the Firebase Auth account behind one of those UIDs is ever deleted
(e.g. manual cleanup of a duplicate/test entry in the Firebase console), the stored
UID goes stale.

**The trap:** `PlayerProfileService.setFirebaseUid()` used to have an absolute
"only ever set once, never overwrite" guard - a reasonable anti-hijack rule in
isolation, but it meant a profile pinned to a dead UID had **no way to
self-correct**, ever. Separately, `PlayersController.maybeOnboard()` didn't check
whether a player's resolved profile already had a live account before minting a
new Firebase user for a season-rollover row with a blank `user_uid` - which is how
a second, divergent Firebase identity got created for the same person in the
first place.

**Symptom:** admins/players report "the password set link keeps saying it's
expired," even on links that load and show the form fine. The real failure was
`consume-invite` (or the underlying Firebase call) silently failing against a
dead UID, and the frontend's old catch-all blamed "expired" for every possible
submit failure regardless of actual cause.

**Fixed 2026-09-16** (real incident: two players' profiles pinned to a deleted
Firebase user while their actual, working account sat unlinked on a different
season's row):
- `PlayerProfileService.setFirebaseUid()` now verifies the currently-stored UID
  still exists in Firebase (`FirebaseAuth.getInstance().getUser(uid)`) before
  refusing to replace it with a new one. A live different UID is still never
  silently overwritten (that would be a real hijack); a dead one now self-heals.
- `PlayersController.maybeOnboard()` now checks the resolved profile's existing
  UID (and that it's still live) before ever calling `onboardPlayer()`, so a
  season-rollover row reuses the person's real account instead of minting a
  duplicate.
- `SetPassword.tsx` and `OnboardingController.consumeInvite` no longer blame
  "expired" for every failure - the frontend surfaces the real error, and the
  backend logs the actual exception (SLF4J, not a swallowed `printStackTrace`).

**If this pattern reappears**, this query finds every affected profile (repeat
per schema, `men`/`women`):

```sql
SELECT p.profile_id, array_agg(DISTINCT p.name) AS names, array_agg(DISTINCT p.user_uid) AS uids
FROM men.players p
WHERE p.profile_id IS NOT NULL AND p.user_uid IS NOT NULL AND p.user_uid <> ''
GROUP BY p.profile_id
HAVING count(DISTINCT p.user_uid) > 1;
```

Don't assume the majority/most-recent UID in the DB is the correct one - check
the Firebase Auth console directly. In both confirmed cases the DB's "official"
UID (`UserAccount`/`PlayerProfile`, and every recent invite link) was actually
the dead one; the real, live account was sitting forgotten on an older row.
