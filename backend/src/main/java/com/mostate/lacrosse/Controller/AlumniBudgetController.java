package com.mostate.lacrosse.Controller;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.mostate.lacrosse.Config.TenantContext;
import com.mostate.lacrosse.Dto.ErrorResponse;
import com.mostate.lacrosse.Model.AlumniBudget;
import com.mostate.lacrosse.Repository.AlumniBudgetRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/alumni-budget")
public class AlumniBudgetController {

    private final AlumniBudgetRepository repository;

    public AlumniBudgetController(AlumniBudgetRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<BudgetResponse>> list() {
        String program = TenantContext.getTenant();
        return ResponseEntity.ok(
            repository.findByProgramOrderByYearDescDisplayOrderAsc(program)
                .stream().map(this::toResponse).toList()
        );
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody BudgetPayload payload) {
        String program = TenantContext.getTenant();
        AlumniBudget entry = new AlumniBudget();
        entry.setProgram(program);
        applyPayload(entry, payload);
        return ResponseEntity.ok(toResponse(repository.save(entry)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody BudgetPayload payload) {
        AlumniBudget entry = repository.findById(id).orElse(null);
        if (entry == null) return ResponseEntity.notFound().build();
        applyPayload(entry, payload);
        return ResponseEntity.ok(toResponse(repository.save(entry)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Accepts CSV text: year,category,description,amount,type */
    @PostMapping("/import")
    public ResponseEntity<?> importCsv(@RequestBody String csvBody) {
        String program = TenantContext.getTenant();
        if (csvBody == null || csvBody.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("CSV body is empty"));
        }
        List<AlumniBudget> imported = new ArrayList<>();
        String[] lines = csvBody.split("\\r?\\n");
        int order = 0;
        for (String line : lines) {
            line = line.trim();
            if (line.isBlank() || line.toLowerCase().startsWith("year")) continue; // skip header
            String[] cols = line.split(",", -1);
            if (cols.length < 4) continue;
            try {
                AlumniBudget entry = new AlumniBudget();
                entry.setProgram(program);
                entry.setYear(TextSanitizer.clean(cols[0].trim()));
                entry.setCategory(TextSanitizer.clean(cols[1].trim()));
                entry.setDescription(TextSanitizer.clean(cols[2].trim()));
                entry.setAmount(new BigDecimal(cols[3].trim().replaceAll("[^\\d.]", "")));
                String et = cols.length > 4 ? cols[4].trim().toUpperCase() : "EXPENSE";
                entry.setEntryType(et.equals("INCOME") ? "INCOME" : "EXPENSE");
                entry.setDisplayOrder(order++);
                imported.add(entry);
            } catch (Exception ignored) {}
        }
        List<AlumniBudget> saved = repository.saveAll(imported);
        return ResponseEntity.ok(saved.stream().map(this::toResponse).toList());
    }

    private void applyPayload(AlumniBudget entry, BudgetPayload payload) {
        if (payload.year() != null) entry.setYear(TextSanitizer.clean(payload.year()));
        if (payload.category() != null) entry.setCategory(TextSanitizer.clean(payload.category()));
        if (payload.description() != null) entry.setDescription(TextSanitizer.clean(payload.description()));
        if (payload.amount() != null) entry.setAmount(payload.amount());
        if (payload.entryType() != null) {
            String t = payload.entryType().toUpperCase();
            entry.setEntryType(t.equals("INCOME") ? "INCOME" : "EXPENSE");
        }
        if (payload.displayOrder() != null) entry.setDisplayOrder(payload.displayOrder());
    }

    private BudgetResponse toResponse(AlumniBudget e) {
        return new BudgetResponse(
            e.getId(), e.getProgram(), e.getYear(), e.getCategory(),
            e.getDescription(), e.getAmount(), e.getEntryType(),
            e.getDisplayOrder(), e.getCreatedAt(), e.getUpdatedAt()
        );
    }

    public record BudgetPayload(
        String year, String category, String description,
        BigDecimal amount, String entryType, Integer displayOrder
    ) {}

    public record BudgetResponse(
        UUID id, String program, String year, String category,
        String description, BigDecimal amount, String entryType,
        int displayOrder, Instant createdAt, Instant updatedAt
    ) {}
}
