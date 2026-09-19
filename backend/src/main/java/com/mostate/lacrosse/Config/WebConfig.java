package com.mostate.lacrosse.Config;

import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig {

    /**
     * Extra origins allowed to call the API, comma separated, for environments such as staging
     * (CORS_EXTRA_ORIGINS). Empty in production.
     */
    @org.springframework.beans.factory.annotation.Value("${app.cors.extra-origins:}")
    private String extraOrigins = "";

    private List<String> allowedOrigins() {
        List<String> origins = new java.util.ArrayList<>(List.of(
            "https://missouristatelacrosse.com",
            "https://www.missouristatelacrosse.com",
            "https://api.missouristatelacrosse.com",
            "http://localhost:5173"
        ));
        for (String extra : extraOrigins.split(",")) {
            if (!extra.isBlank()) {
                origins.add(extra.trim());
            }
        }
        return origins;
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                    .allowedOrigins(
                        "https://missouristatelacrosse.com",
                        "https://www.missouristatelacrosse.com",
                        "https://api.missouristatelacrosse.com",
                        "http://localhost:5173"
                    )
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(true);
            }

            @Override
            public void addResourceHandlers(ResourceHandlerRegistry registry) {
                // Removed: Custom products now use S3
            }
        };
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        FilterRegistrationBean<CorsFilter> bean =
            new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
