-- CreateIndex
CREATE INDEX "Shipment_merchantId_status_createdAt_idx" ON "Shipment"("merchantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_status_deliveredAt_idx" ON "Shipment"("status", "deliveredAt");

-- CreateIndex
CREATE INDEX "Shipment_deliveredAt_idx" ON "Shipment"("deliveredAt");
