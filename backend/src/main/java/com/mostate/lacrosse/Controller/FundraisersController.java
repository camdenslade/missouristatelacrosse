package com.mostate.lacrosse.Controller;

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
import com.mostate.lacrosse.Model.Fundraiser;
import com.mostate.lacrosse.Repository.FundraiserRepository;
import com.mostate.lacrosse.Utils.TextSanitizer;

@RestController
@RequestMapping("/api/fundraisers")
public class FundraisersController {
    private final FundraiserRepository repository;

    public FundraisersController(FundraiserRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<Fundraiser>> list() {
        return ResponseEntity.ok(repository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping
    public ResponseEntity<Fundraiser> create(@RequestBody Fundraiser fundraiser) {
        Fundraiser sanitized = new Fundraiser();
        sanitized.setTitle(TextSanitizer.clean(fundraiser.getTitle()));
        sanitized.setLink(TextSanitizer.clean(fundraiser.getLink()));
        sanitized.setActive(fundraiser.isActive());
        return ResponseEntity.ok(repository.save(sanitized));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Fundraiser> update(
        @PathVariable UUID id,
        @RequestBody Fundraiser payload
    ) {
        Fundraiser existing = repository.findById(id).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        existing.setTitle(TextSanitizer.clean(payload.getTitle()));
        existing.setLink(TextSanitizer.clean(payload.getLink()));
        existing.setActive(payload.isActive());
        return ResponseEntity.ok(repository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
