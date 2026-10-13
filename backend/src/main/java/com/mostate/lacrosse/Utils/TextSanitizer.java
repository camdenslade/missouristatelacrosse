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

    /**
     * "tyler cole" / "TYLER COLE" -> "Tyler Cole" - fixes up free-typed person names so
     * things like event registrant lists and raffle winner names display consistently,
     * regardless of how someone capitalized it in the form. Leaves names that already have
     * mixed case alone where a word has an uppercase letter after the first (e.g. "McCole",
     * "O'Brien") since forcing those to plain title case would make them wrong.
     */
    public static String titleCaseName(String input) {
        String cleaned = clean(input);
        if (cleaned == null || cleaned.isEmpty()) {
            return cleaned;
        }
        StringBuilder out = new StringBuilder(cleaned.length());
        boolean startOfWord = true;
        for (int i = 0; i < cleaned.length(); i++) {
            char c = cleaned.charAt(i);
            if (Character.isLetter(c)) {
                out.append(startOfWord ? Character.toUpperCase(c) : Character.toLowerCase(c));
                startOfWord = false;
            } else {
                out.append(c);
                // Hyphens and apostrophes start a new capitalized segment ("Smith-Jones",
                // "O'Brien"); everything else (spaces, periods) does too.
                startOfWord = true;
            }
        }
        String result = out.toString();
        // If the original already had a capital letter past a word's first character
        // (e.g. "McCole", "DeShawn"), trust the author's casing instead of flattening it.
        if (hasInteriorCapital(cleaned)) {
            return cleaned;
        }
        return result;
    }

    private static boolean hasInteriorCapital(String s) {
        boolean startOfWord = true;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLetter(c)) {
                if (!startOfWord && Character.isUpperCase(c)) {
                    return true;
                }
                startOfWord = false;
            } else {
                startOfWord = true;
            }
        }
        return false;
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
