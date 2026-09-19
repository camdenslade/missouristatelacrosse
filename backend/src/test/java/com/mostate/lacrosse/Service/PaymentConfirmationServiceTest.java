package com.mostate.lacrosse.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.mostate.lacrosse.Model.PaymentReceipt;
import com.mostate.lacrosse.Repository.PaymentReceiptRepository;
import com.mostate.lacrosse.Service.PaymentConfirmationService.Kind;
import com.mostate.lacrosse.Service.PaymentConfirmationService.Result;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PaymentConfirmationServiceTest {

    private PaymentReceiptRepository receipts;
    private EmailService email;
    private PaymentConfirmationService service;

    @BeforeEach
    void setUp() {
        receipts = mock(PaymentReceiptRepository.class);
        email = mock(EmailService.class);
        service = new PaymentConfirmationService(receipts, email);
    }

    private static PaymentReceipt receipt(String status, String payerEmail) {
        PaymentReceipt r = new PaymentReceipt();
        r.setOrderId("ORDER-1");
        r.setStatus(status);
        r.setPayerEmail(payerEmail);
        r.setPayerName("Pat Payer");
        r.setAmount(new BigDecimal("25.5"));
        return r;
    }

    @Test
    void sendsOnlyToTheEmailOnTheStoredPayment() {
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(receipt("COMPLETED", "payer@example.com")));
        when(receipts.claimReceiptSend("ORDER-1")).thenReturn(1);
        when(email.sendEmail(anyString(), anyString(), anyString())).thenReturn(true);

        assertEquals(Result.SENT, service.send("ORDER-1", Kind.DONATION));

        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(email).sendEmail(to.capture(), anyString(), body.capture());
        assertEquals("payer@example.com", to.getValue());
        assertTrue(body.getValue().contains("$25.50"));
        assertTrue(body.getValue().contains("Pat Payer"));
    }

    @Test
    void unknownOrderSendsNothing() {
        when(receipts.findByOrderId("nope")).thenReturn(Optional.empty());

        assertEquals(Result.NOT_FOUND, service.send("nope", Kind.ORDER));
        assertEquals(Result.NOT_FOUND, service.send("  ", Kind.ORDER));
        assertEquals(Result.NOT_FOUND, service.send(null, Kind.ORDER));
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void incompletePaymentSendsNothing() {
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(receipt("CREATED", "payer@example.com")));

        assertEquals(Result.NOT_COMPLETED, service.send("ORDER-1", Kind.ORDER));
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void paymentWithoutAnEmailSendsNothing() {
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(receipt("COMPLETED", " ")));

        assertEquals(Result.NO_EMAIL, service.send("ORDER-1", Kind.ORDER));
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void anOrderIsNotMailedTwice() {
        PaymentReceipt already = receipt("COMPLETED", "payer@example.com");
        already.setReceiptSentAt(Instant.now());
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(already));

        assertEquals(Result.ALREADY_SENT, service.send("ORDER-1", Kind.DONATION));
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void aLostRaceSendsNothing() {
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(receipt("COMPLETED", "payer@example.com")));
        when(receipts.claimReceiptSend("ORDER-1")).thenReturn(0);

        assertEquals(Result.ALREADY_SENT, service.send("ORDER-1", Kind.DONATION));
        verify(email, never()).sendEmail(anyString(), anyString(), anyString());
    }

    @Test
    void aFailedSendReleasesTheClaimSoItCanBeRetried() {
        when(receipts.findByOrderId("ORDER-1")).thenReturn(Optional.of(receipt("COMPLETED", "payer@example.com")));
        when(receipts.claimReceiptSend("ORDER-1")).thenReturn(1);
        when(email.sendEmail(anyString(), anyString(), anyString())).thenReturn(false);

        assertEquals(Result.FAILED, service.send("ORDER-1", Kind.ORDER));
        verify(receipts).releaseReceiptSend("ORDER-1");
    }

    @Test
    void payerNameIsHtmlEscapedSoItCannotInjectMarkup() {
        PaymentReceipt r = receipt("COMPLETED", "payer@example.com");
        r.setPayerName("<a href=\"https://evil.example\">click</a>");

        String body = PaymentConfirmationService.body(Kind.ORDER, r);

        assertFalse(body.contains("<a href"));
        assertTrue(body.contains("&lt;a href"));
    }

    @Test
    void everyKindHasItsOwnWording() {
        PaymentReceipt r = receipt("COMPLETED", "payer@example.com");
        assertTrue(PaymentConfirmationService.body(Kind.ORDER, r).contains("ORDER-1"));
        assertTrue(PaymentConfirmationService.body(Kind.FUNDRAISER, r).contains("501(c)(3)"));
        assertTrue(PaymentConfirmationService.body(Kind.DONATION, r).contains("to Missouri State Lacrosse"));
        assertEquals("Order Receipt - Missouri State Lacrosse", PaymentConfirmationService.subject(Kind.ORDER));
    }
}
