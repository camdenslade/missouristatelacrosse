package com.mostate.lacrosse.Config;

import java.util.Map;
import org.springframework.context.annotation.Configuration;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Configuration
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
            Map<String, String> secrets = mapper.readValue(secretJson, Map.class);

            System.setProperty("PAYPAL_CLIENT_ID", secrets.get("PAYPAL_CLIENT_ID"));
            System.setProperty("PAYPAL_CLIENT_SECRET", secrets.get("PAYPAL_CLIENT_SECRET"));
            System.setProperty("PRINTIFY_API_TOKEN", secrets.get("PRINTIFY_API_TOKEN"));
            System.setProperty("PRINTIFY_SHOP_ID", secrets.get("PRINTIFY_SHOP_ID"));
            System.setProperty("AWS_SES_SENDER", secrets.get("AWS_SES_SENDER"));
            System.setProperty("AWS_REGION", secrets.get("AWS_REGION"));
            System.setProperty("PAYPAL_BASE_URL", secrets.get("PAYPAL_BASE_URL"));
            System.setProperty("PRINTIFY_BASE_URL", secrets.get("PRINTIFY_BASE_URL"));

            System.out.println("App secrets loaded successfully from AWS Secrets Manager.");

        } catch (Exception e) {
            System.err.println("Failed to load app secrets: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }
}
