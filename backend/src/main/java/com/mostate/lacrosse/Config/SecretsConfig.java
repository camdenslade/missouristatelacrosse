package com.mostate.lacrosse.Config;

import java.util.Map;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Configuration
@Profile("!test")
public class SecretsConfig {

    @PostConstruct
    public void init() {
        try {
            Region region = Region.of(System.getenv().getOrDefault("AWS_REGION", "us-east-1"));
            SecretsManagerClient client = SecretsManagerClient.builder()
                    .region(region)
                    .build();

            GetSecretValueRequest request = GetSecretValueRequest.builder()
                    .secretId("backend-prod")
                    .build();

            GetSecretValueResponse response = client.getSecretValue(request);
            String secretJson = response.secretString();

            ObjectMapper mapper = new ObjectMapper();
            Map<String, String> secrets = mapper.readValue(
                secretJson,
                new TypeReference<Map<String, String>>() {}
            );

            setPropertyIfPresent(secrets, "PAYPAL_CLIENT_ID");
            setPropertyIfPresent(secrets, "PAYPAL_CLIENT_SECRET");
            setPropertyIfPresent(secrets, "PRINTIFY_API_TOKEN");
            setPropertyIfPresent(secrets, "PRINTIFY_SHOP_ID");
            setPropertyIfPresent(secrets, "AWS_SES_SENDER");
            setPropertyIfPresent(secrets, "AWS_REGION");
            setPropertyIfPresent(secrets, "PAYPAL_BASE_URL");
            setPropertyIfPresent(secrets, "PRINTIFY_BASE_URL");
            setPropertyIfPresent(secrets, "DB_URL");
            setPropertyIfPresent(secrets, "DB_USER");
            setPropertyIfPresent(secrets, "DB_PASSWORD");
            setPropertyIfPresent(secrets, "S3_BUCKET");
            setPropertyIfPresent(secrets, "S3_PUBLIC_BASE_URL");

            System.out.println("App secrets loaded successfully from AWS Secrets Manager.");

        } catch (Exception e) {
            System.err.println("Failed to load app secrets: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    private void setPropertyIfPresent(Map<String, String> secrets, String key) {
        String value = secrets.get(key);
        if (value != null) {
            System.setProperty(key, value);
        }
    }
}
