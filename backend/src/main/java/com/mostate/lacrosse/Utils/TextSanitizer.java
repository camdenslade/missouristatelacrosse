package com.mostate.lacrosse.Utils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public final class TextSanitizer {
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\r\\n\\t]]");

    private TextSanitizer() {}

    public static String clean(String input) {
        if (input == null) {
            return null;
        }
        String sanitized = input.trim();
        sanitized = stripTags(sanitized);
        sanitized = CONTROL.matcher(sanitized).replaceAll("");
        return sanitized;
    }

    /**
     * Removes every complete "<...>" run. Same result as the regex "(?s)<[^>]*>", but a single pass:
     * the regex rescans to the end of the string for every "<" that has no closing ">", which takes
     * quadratic time on input like "<<<<<<...". This runs on public form fields, so that matters.
     */
    static String stripTags(String input) {
        StringBuilder out = new StringBuilder(input.length());
        int i = 0;
        while (i < input.length()) {
            int open = input.indexOf('<', i);
            if (open < 0) {
                break;
            }
            int close = input.indexOf('>', open + 1);
            if (close < 0) {
                // No ">" anywhere after this "<", so no later "<" can form a tag either.
                break;
            }
            out.append(input, i, open);
            i = close + 1;
        }
        out.append(input, i, input.length());
        return out.toString();
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
