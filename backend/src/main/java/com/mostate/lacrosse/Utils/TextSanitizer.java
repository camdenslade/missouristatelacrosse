package com.mostate.lacrosse.Utils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class TextSanitizer {
    private static final Pattern TAGS = Pattern.compile("(?s)<[^>]*>");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\r\\n\\t]]");

    private TextSanitizer() {}

    public static String clean(String input) {
        if (input == null) {
            return null;
        }
        String sanitized = input.trim();
        sanitized = TAGS.matcher(sanitized).replaceAll("");
        sanitized = CONTROL.matcher(sanitized).replaceAll("");
        return sanitized;
    }

    public static List<String> cleanStringList(List<String> input) {
        if (input == null) {
            return null;
        }
        List<String> output = new ArrayList<>(input.size());
        for (String value : input) {
            output.add(clean(value));
        }
        return output;
    }

    public static Map<String, Object> cleanMap(Map<String, Object> input) {
        if (input == null) {
            return null;
        }
        Map<String, Object> output = new HashMap<>();
        for (Map.Entry<String, Object> entry : input.entrySet()) {
            String key = clean(entry.getKey());
            if (key != null) {
                output.put(key, cleanValue(entry.getValue()));
            }
        }
        return output;
    }

    private static Object cleanValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            return clean(text);
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> cast = new HashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() != null) {
                    String key = clean(String.valueOf(entry.getKey()));
                    if (key != null) {
                        cast.put(key, cleanValue(entry.getValue()));
                    }
                }
            }
            return cast;
        }
        if (value instanceof List<?> list) {
            List<Object> cleaned = new ArrayList<>(list.size());
            for (Object item : list) {
                cleaned.add(cleanValue(item));
            }
            return cleaned;
        }
        return value;
    }
}
