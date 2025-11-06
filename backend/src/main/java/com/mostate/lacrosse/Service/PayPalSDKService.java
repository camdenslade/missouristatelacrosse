package com.mostate.lacrosse.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Service
public class PayPalSDKService {

    @Value("${paypal.client.id}")
    private String clientId;

    @Value("${paypal.client.secret}")
    private String clientSecret;

    @Value("${paypal.base-url}")
    private String baseUrl;

    private final RestTemplate rest = new RestTemplate();

    public Map<String, Object> createOrder(String amount){
        try{
            String credentials = clientId + ":" + clientSecret;
            String encoded = Base64.getEncoder()
                    .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));

            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            tokenHeaders.set("Authorization", "Basic " + encoded);

            HttpEntity<String> tokenRequest =
                    new HttpEntity<>("grant_type=client_credentials", tokenHeaders);

            ResponseEntity<Map> tokenResponse = rest.exchange(
                    baseUrl + "/v1/oauth2/token",
                    HttpMethod.POST,
                    tokenRequest,
                    Map.class
            );

            String accessToken = (String) tokenResponse.getBody().get("access_token");
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            String orderBody = """
                {
                  "intent": "CAPTURE",
                  "purchase_units": [
                    {
                      "amount": {
                        "currency_code": "USD",
                        "value": "%s"
                      }
                    }
                  ],
                  "application_context": {
                    "brand_name": "Missouri State Lacrosse",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW",
                    "return_url": "https://missouristatelacrosse-cc913.web.app/checkout-success",
                    "cancel_url": "https://missouristatelacrosse-cc913.web.app/teamstore"
                  }
                }
                """.formatted(amount);

            HttpEntity<String> orderRequest = new HttpEntity<>(orderBody, headers);
            ResponseEntity<Map> orderResponse = rest.exchange(
                    baseUrl + "/v2/checkout/orders",
                    HttpMethod.POST,
                    orderRequest,
                    Map.class
            );

            return orderResponse.getBody();

        } catch (Exception e){
            e.printStackTrace();
            throw new RuntimeException("Failed to create PayPal order: " + e.getMessage());
        }
    }

    public Map<String, Object> captureOrder(String orderID){
        try{
            String credentials = clientId + ":" + clientSecret;
            String encoded = Base64.getEncoder()
                    .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));

            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            tokenHeaders.set("Authorization", "Basic " + encoded);

            HttpEntity<String> tokenRequest =
                    new HttpEntity<>("grant_type=client_credentials", tokenHeaders);

            ResponseEntity<Map> tokenResponse = rest.exchange(
                    baseUrl + "/v1/oauth2/token",
                    HttpMethod.POST,
                    tokenRequest,
                    Map.class
            );

            String accessToken = (String) tokenResponse.getBody().get("access_token");

            // Capture the order
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> captureRequest = new HttpEntity<>("{}", headers);

            ResponseEntity<Map> captureResponse = rest.exchange(
                    baseUrl + "/v2/checkout/orders/" + orderID + "/capture",
                    HttpMethod.POST,
                    captureRequest,
                    Map.class
            );

            return captureResponse.getBody();

        } catch (Exception e){
            e.printStackTrace();
            throw new RuntimeException("Failed to capture PayPal order: " + e.getMessage());
        }
    }
}
