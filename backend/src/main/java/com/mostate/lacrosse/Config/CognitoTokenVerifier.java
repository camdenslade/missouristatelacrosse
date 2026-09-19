package com.mostate.lacrosse.Config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URL;
import java.util.HashSet;
import java.util.Set;

/**
 * Verifies Cognito ID tokens. Disabled (every call returns null / isIssuer is false) until a
 * user pool id and app client id are configured, so deployments without Cognito behave as before.
 */
@Component
public class CognitoTokenVerifier {

    public record Identity(String sub, String email) {}

    private final String issuer;
    private final DefaultJWTProcessor<SecurityContext> processor;

    @Autowired
    public CognitoTokenVerifier(
            @Value("${app.cognito.user-pool-id:}") String userPoolId,
            @Value("${app.cognito.client-id:}") String clientId,
            @Value("${app.cognito.region:us-east-1}") String region) throws Exception {
        if (userPoolId.isBlank() || clientId.isBlank()) {
            this.issuer = null;
            this.processor = null;
            return;
        }
        this.issuer = "https://cognito-idp." + region + ".amazonaws.com/" + userPoolId;
        JWKSource<SecurityContext> keys =
            JWKSourceBuilder.create(new URL(issuer + "/.well-known/jwks.json")).build();
        this.processor = build(issuer, clientId, keys);
    }

    /** For tests: supply the key source directly. */
    public CognitoTokenVerifier(String issuer, String clientId, JWKSource<SecurityContext> keys) {
        this.issuer = issuer;
        this.processor = build(issuer, clientId, keys);
    }

    private static DefaultJWTProcessor<SecurityContext> build(
            String issuer, String clientId, JWKSource<SecurityContext> keys) {
        DefaultJWTProcessor<SecurityContext> p = new DefaultJWTProcessor<>();
        p.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keys));
        p.setJWTClaimsSetVerifier(new DefaultJWTClaimsVerifier<SecurityContext>(
            new HashSet<>(Set.of(clientId)),
            new JWTClaimsSet.Builder().issuer(issuer).claim("token_use", "id").build(),
            new HashSet<>(Set.of("sub", "exp", "iat")),
            (Set<String>) null));
        return p;
    }

    public boolean enabled() {
        return processor != null;
    }

    /** True when the token claims to come from our pool. Says nothing about validity. */
    public boolean isIssuer(String token) {
        if (!enabled()) {
            return false;
        }
        try {
            return issuer.equals(SignedJWT.parse(token).getJWTClaimsSet().getIssuer());
        } catch (Exception e) {
            return false;
        }
    }

    /** Returns the verified identity, or null if the token is invalid, expired or unverified. */
    public Identity verify(String token) {
        if (!enabled()) {
            return null;
        }
        try {
            JWTClaimsSet claims = processor.process(token, null);
            String email = claims.getStringClaim("email");
            Boolean verified = claims.getBooleanClaim("email_verified");
            if (email == null || email.isBlank() || !Boolean.TRUE.equals(verified)) {
                return null;
            }
            return new Identity(claims.getSubject(), email.trim().toLowerCase());
        } catch (Exception e) {
            return null;
        }
    }
}
