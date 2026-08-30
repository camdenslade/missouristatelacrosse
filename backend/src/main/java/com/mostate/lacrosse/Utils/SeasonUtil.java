package com.mostate.lacrosse.Utils;

import java.time.LocalDate;

public final class SeasonUtil {
    private SeasonUtil() {}

    public static String currentSeason() {
        return currentSeason(LocalDate.now());
    }

    public static String currentSeason(LocalDate date) {
        int year = date.getYear();
        int start = date.getMonthValue() >= 8 ? year : year - 1;
        return String.format("%02d-%02d", start % 100, (start + 1) % 100);
    }
}
