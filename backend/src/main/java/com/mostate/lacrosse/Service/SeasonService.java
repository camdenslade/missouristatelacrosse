package com.mostate.lacrosse.Service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.mostate.lacrosse.Model.Season;
import com.mostate.lacrosse.Repository.CoachRepository;
import com.mostate.lacrosse.Repository.GameRepository;
import com.mostate.lacrosse.Repository.PlayerRepository;
import com.mostate.lacrosse.Repository.SeasonRepository;
import com.mostate.lacrosse.Utils.SeasonUtil;
import com.mostate.lacrosse.Utils.TextSanitizer;

@Service
public class SeasonService {

    private final SeasonRepository seasonRepo;
    private final PlayerRepository playerRepo;
    private final GameRepository gameRepo;
    private final CoachRepository coachRepo;

    public SeasonService(
        SeasonRepository seasonRepo,
        PlayerRepository playerRepo,
        GameRepository gameRepo,
        CoachRepository coachRepo
    ) {
        this.seasonRepo = seasonRepo;
        this.playerRepo = playerRepo;
        this.gameRepo = gameRepo;
        this.coachRepo = coachRepo;
    }

    public List<Season> list() {
        return seasonRepo.findAllByOrderBySortOrderAscCodeAsc();
    }

    /** Falls back to the date-computed season if no row is marked active (defensive only —
     *  the V27 migration seeds one, so this should never actually trigger in practice). */
    public String getActiveCode() {
        return seasonRepo.findByActiveTrue()
            .map(Season::getCode)
            .orElseGet(SeasonUtil::currentSeason);
    }

    @Transactional
    public Season create(String code, String label, Integer sortOrder) {
        String cleanCode = TextSanitizer.clean(code);
        if (cleanCode == null || cleanCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Season code is required");
        }
        if (seasonRepo.existsByCode(cleanCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A season with that code already exists");
        }
        Season season = new Season();
        season.setCode(cleanCode);
        season.setLabel(TextSanitizer.clean(label));
        season.setSortOrder(sortOrder != null ? sortOrder : 0);
        // First season ever created (shouldn't normally happen given the V27 seed) becomes active.
        season.setActive(seasonRepo.findByActiveTrue().isEmpty());
        return seasonRepo.save(season);
    }

    @Transactional
    public Season update(java.util.UUID id, String label, Integer sortOrder) {
        Season season = seasonRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Season not found"));
        if (label != null) season.setLabel(TextSanitizer.clean(label));
        if (sortOrder != null) season.setSortOrder(sortOrder);
        return seasonRepo.save(season);
    }

    @Transactional
    public Season setActive(java.util.UUID id) {
        Season target = seasonRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Season not found"));
        seasonRepo.findByActiveTrue().ifPresent(current -> {
            if (!current.getId().equals(id)) {
                current.setActive(false);
                seasonRepo.save(current);
            }
        });
        target.setActive(true);
        return seasonRepo.save(target);
    }

    @Transactional
    public void delete(java.util.UUID id) {
        Season season = seasonRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Season not found"));

        boolean inUse = !playerRepo.findAllBySeason(season.getCode()).isEmpty()
            || gameRepo.existsBySeason(season.getCode())
            || coachRepo.existsBySeason(season.getCode());
        if (inUse) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Season \"" + season.getCode() + "\" still has players, games, or coaches recorded under it — remove or reassign those first"
            );
        }
        seasonRepo.delete(season);
    }
}
