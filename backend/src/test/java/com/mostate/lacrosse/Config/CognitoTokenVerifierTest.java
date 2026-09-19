package com.mostate.lacrosse.Config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.util.Date;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class CognitoTokenVerifierTest {

    private static final String ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test";
    private static final String CLIENT = "client-123";

    private static RSAKey signingKey;
    private static RSAKey otherKey;
    private static CognitoTokenVerifier verifier;

    @BeforeAll
    static void setUp() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID("k1").generate();
        otherKey = new RSAKeyGenerator(2048).keyID("k1").generate();
        verifier = new CognitoTokenVerifier(ISSUER, CLIENT,
            new ImmutableJWKSet<>(new JWKSet(signingKey.toPublicJWK())));
    }

    private static String token(RSAKey key, String issuer, String aud, String use,
                                boolean emailVerified, long expiresInMs) throws Exception {
        Date now = new Date();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject("sub-abc")
            .audience(aud)
            .claim("token_use", use)
            .claim("email", "Player@Example.com")
            .claim("email_verified", emailVerified)
            .issueTime(now)
            .expirationTime(new Date(now.getTime() + expiresInMs))
            .build();
        SignedJWT jwt = new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("k1").type(JOSEObjectType.JWT).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    @Test
    void acceptsValidIdTokenAndLowercasesEmail() throws Exception {
        CognitoTokenVerifier.Identity id =
            verifier.verify(token(signingKey, ISSUER, CLIENT, "id", true, 60_000));
        assertNotNull(id);
        assertEquals("sub-abc", id.sub());
        assertEquals("player@example.com", id.email());
    }

    @Test
    void rejectsWrongAudience() throws Exception {
        assertNull(verifier.verify(token(signingKey, ISSUER, "other-client", "id", true, 60_000)));
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        assertNull(verifier.verify(token(signingKey, ISSUER, CLIENT, "id", true, -120_000)));
    }

    @Test
    void rejectsWrongIssuer() throws Exception {
        assertNull(verifier.verify(token(signingKey, "https://evil.example.com/pool", CLIENT, "id", true, 60_000)));
    }

    @Test
    void rejectsAccessTokens() throws Exception {
        assertNull(verifier.verify(token(signingKey, ISSUER, CLIENT, "access", true, 60_000)));
    }

    @Test
    void rejectsUnverifiedEmail() throws Exception {
        assertNull(verifier.verify(token(signingKey, ISSUER, CLIENT, "id", false, 60_000)));
    }

    @Test
    void rejectsTokenSignedWithAnotherKey() throws Exception {
        assertNull(verifier.verify(token(otherKey, ISSUER, CLIENT, "id", true, 60_000)));
    }

    @Test
    void rejectsGarbage() {
        assertNull(verifier.verify("not.a.jwt"));
    }

    @Test
    void recognisesOwnIssuerButNotFirebase() throws Exception {
        assertTrue(verifier.isIssuer(token(signingKey, ISSUER, CLIENT, "id", true, 60_000)));
        assertFalse(verifier.isIssuer(
            token(signingKey, "https://securetoken.google.com/some-project", CLIENT, "id", true, 60_000)));
    }

    @Test
    void disabledWhenNotConfigured() throws Exception {
        CognitoTokenVerifier off = new CognitoTokenVerifier("", "", "us-east-1");
        assertFalse(off.enabled());
        assertFalse(off.isIssuer(token(signingKey, ISSUER, CLIENT, "id", true, 60_000)));
        assertNull(off.verify(token(signingKey, ISSUER, CLIENT, "id", true, 60_000)));
    }
}
