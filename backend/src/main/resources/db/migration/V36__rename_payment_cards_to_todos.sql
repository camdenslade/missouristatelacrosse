ALTER TABLE men.payment_cards RENAME TO todos;
ALTER TABLE women.payment_cards RENAME TO todos;

ALTER TABLE men.payment_card_status RENAME TO todo_status;
ALTER TABLE women.payment_card_status RENAME TO todo_status;

ALTER TABLE men.todo_status RENAME COLUMN card_id TO todo_id;
ALTER TABLE women.todo_status RENAME COLUMN card_id TO todo_id;

ALTER TABLE men.todos DROP COLUMN amount;
ALTER TABLE women.todos DROP COLUMN amount;
