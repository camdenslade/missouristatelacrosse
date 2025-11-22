package com.mostate.lacrosse.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.mostate.lacrosse.Controller.Printify.PrintifyOrderRequest;
import com.mostate.lacrosse.Controller.Printify.ShippingInfo;

@Service
public class PrintifyService {

    @Value("${PRINTIFY_BASE_URL}")
    private String baseUrl;

    @Value("${PRINTIFY_API_TOKEN}")
    private String apiToken;

    @Value("${PRINTIFY_SHOP_ID}")
    private String shopId;

    private final RestTemplate rest = new RestTemplate();

    public List<Map<String, Object>> getProducts() {
        try {
            String url = baseUrl + "/shops/" + shopId + "/products.json";

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map> response = rest.exchange(url, HttpMethod.GET, request, Map.class);

            Object dataRaw = response.getBody() != null ? response.getBody().get("data") : null;
            if (!(dataRaw instanceof List<?> dataList)) return List.of();

            List<Map<String, Object>> products = new java.util.ArrayList<>();

            for (Object obj : dataList) {
                Map<String, Object> product = (Map<String, Object>) obj;

                List<Map<String, Object>> variants = (List<Map<String, Object>>) product.get("variants");
                for (Map<String, Object> variant : variants) {

                    Object priceObj = variant.get("price");
                    double basePrice = (priceObj instanceof Number n) ? n.doubleValue() / 100.0 :
                                    Double.parseDouble(priceObj.toString()) / 100.0;

                    double adjusted = Math.round(((basePrice + 5) / 5)) * 5;

                    variant.put("our_price", (int) (adjusted * 100));
                }

                products.add(product);
            }

            return products;

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to fetch Printify products: " + e.getMessage());
        }
    }


    public Map<String, Object> createOrder(PrintifyOrderRequest req) {
        try {
            String url = baseUrl + "/shops/" + shopId + "/orders.json";

            Map<String, Object> body = new HashMap<>();
            body.put("external_id", req.getOrderId());
            body.put("label", "TeamStore Checkout");

            List<Map<String, Object>> lineItems = req.getItems().stream().map(item -> {
                Map<String, Object> i = new HashMap<>();
                i.put("product_id", item.getProductId());
                i.put("variant_id", item.getVariantId());
                i.put("quantity", item.getQuantity());
                return i;
            }).collect(Collectors.toList());

            body.put("line_items", lineItems);
            body.put("shipping_method", 1);
            body.put("send_shipping_notification", true);

            ShippingInfo s = req.getShipping();
            Map<String, Object> addr = new HashMap<>();
            addr.put("first_name", s.getFirstName());
            addr.put("last_name", s.getLastName());
            addr.put("email", s.getEmail());
            addr.put("phone", s.getPhone());
            addr.put("country", s.getCountry());
            addr.put("region", s.getRegion());
            addr.put("address1", s.getAddress1());
            addr.put("address2", s.getAddress2());
            addr.put("city", s.getCity());
            addr.put("zip", s.getZip());
            body.put("address_to", addr);

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = rest.exchange(url, HttpMethod.POST, request, Map.class);

            return response.getBody();

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to create Printify order: " + e.getMessage());
        }
    }
}
