package com.mostate.lacrosse.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.mostate.lacrosse.Model.UserAccount;
import com.mostate.lacrosse.Repository.UserAccountRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Runs with no user pool configured, so only uid resolution is exercised. */
class IdentityServiceTest {

    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final IdentityService identity = new IdentityService(users, "", "us-east-1");

    private static UserAccount account(String uid, String email) {
        UserAccount a = new UserAccount();
        a.setFirebaseUid(uid);
        a.setEmail(email);
        return a;
    }

    @Test
    void existingAccountKeepsItsUidWhateverTheProviderSays() {
        when(users.findByEmailIgnoreCase("player@example.com"))
            .thenReturn(Optional.of(account("stable-uid-1", "Player@Example.com")));

        IdentityService.Account result = identity.createOrGetAccount("  Player@Example.com ", "Player");

        assertEquals("stable-uid-1", result.getUid());
        assertNull(result.cognitoSub());
    }

    @Test
    void newAccountGetsAGeneratedOpaqueUid() {
        when(users.findByEmailIgnoreCase("new@example.com")).thenReturn(Optional.empty());

        String uid = identity.createOrGetAccount("new@example.com", "New Person").getUid();

        UUID.fromString(uid);
        assertNotEquals(uid, identity.createOrGetAccount("new@example.com", "New Person").getUid());
    }

    @Test
    void accountKnownOnlyForExistingAccounts() {
        when(users.findByFirebaseUid("known")).thenReturn(Optional.of(account("known", "a@b.c")));
        when(users.findByFirebaseUid("gone")).thenReturn(Optional.empty());

        assertTrue(identity.accountKnown("known"));
        assertFalse(identity.accountKnown("gone"));
        assertFalse(identity.accountKnown(""));
        assertFalse(identity.accountKnown(null));
    }

    @Test
    void settingAPasswordWithoutAConfiguredPoolFailsLoudly() {
        when(users.findByFirebaseUid("u")).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> identity.setPassword("u", "a@b.c", "password123"));
    }

    @Test
    void changingEmailWithoutAConfiguredPoolIsANoOpSuccess() {
        assertTrue(identity.changeEmail("u", "new@example.com"));
    }
}
