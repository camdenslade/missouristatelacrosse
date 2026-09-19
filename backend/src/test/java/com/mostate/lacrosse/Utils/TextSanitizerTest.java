package com.mostate.lacrosse.Utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class TextSanitizerTest {

    // The previous implementation, kept only to prove the new one gives the same answers.
    private static final Pattern OLD_TAGS = Pattern.compile("(?s)<[^>]*>");

    private static final List<String> SAMPLES = List.of(
        "",
        "plain text",
        "<b>bold</b> and <i>italic</i>",
        "<script>alert(1)</script>hello",
        "a < b and c > d",
        "1 <2 3> 4",
        "unclosed <tag never ends",
        "<<a>>",
        "<a<b>c>",
        "<>",
        "><",
        "<div\nclass=\"x\">multi\nline</div>",
        "text<",
        "<text",
        "<a><b><c>",
        "x<y>z<w"
    );

    @Test
    void stripTagsMatchesTheOldRegexOnEverySample() {
        for (String sample : SAMPLES) {
            assertEquals(OLD_TAGS.matcher(sample).replaceAll(""), TextSanitizer.stripTags(sample), "input: " + sample);
        }
    }

    @Test
    void cleanStillTrimsAndStripsTags() {
        assertEquals("hello", TextSanitizer.clean("  <b>hello</b>  "));
        assertNull(TextSanitizer.clean(null));
    }

    @Test
    void hostileInputWithManyOpenAnglesFinishesQuickly() {
        String hostile = "<".repeat(200_000);
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> TextSanitizer.clean(hostile));
    }

    @Test
    void hostileInputWithManyTagsFinishesQuickly() {
        String hostile = "<a>".repeat(100_000) + "<";
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> TextSanitizer.clean(hostile));
    }
}
