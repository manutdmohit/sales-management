"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatDateYmd } from "@/lib/format-datetime";
import { toast } from "sonner";
import type { Client, PaymentMethod, PaymentReceipt, Product, SaleType } from "@/domain/types";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";

type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

const emptyCustomer = { name: "", phone: "", email: "" };

function PosAddControl({
  stock,
  inCart,
  onAdd,
  onDecrement,
  onRemove,
}: {
  stock: number;
  inCart: number;
  onAdd: (quantity: number) => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");

  const parsed = Math.floor(Number(qty));
  const canAdd = stock > 0 && parsed > 0 && parsed <= stock;
  const canIncrement = stock > 0;

  function handleAdd() {
    if (!canAdd) return;
    onAdd(parsed);
    setQty("1");
    setOpen(false);
  }

  function handleCancel() {
    setQty("1");
    setOpen(false);
  }

  if (stock <= 0 && inCart === 0) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        Add
      </Button>
    );
  }

  if (open) {
    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <Input
          type="number"
          min={1}
          max={Math.max(1, stock)}
          step={1}
          inputMode="numeric"
          aria-label="Quantity to add"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") handleCancel();
          }}
          className="h-8 w-14 shrink-0 px-1.5 text-center font-mono tabular-nums"
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!canAdd}
          onClick={handleAdd}
        >
          Add
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (inCart > 0) {
    return (
      <div
        className="inline-flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5"
        role="group"
        aria-label="Cart quantity"
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={onDecrement}
          aria-label={inCart <= 1 ? "Remove from cart" : "Decrease quantity"}
        >
          <Minus className="size-4" />
        </Button>
        <button
          type="button"
          className="min-w-8 cursor-pointer px-1 text-center font-mono text-sm font-semibold tabular-nums hover:text-primary"
          onClick={() => setOpen(true)}
          title="Add more (custom quantity)"
          aria-label={`${inCart} in cart, click to add more`}
        >
          {inCart}
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          disabled={!canIncrement}
          onClick={() => onAdd(1)}
          aria-label="Increase quantity"
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove from cart"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="min-h-10 touch-manipulation sm:min-h-8"
      disabled={stock <= 0}
      onClick={() => setOpen(true)}
    >
      <Plus className="size-4" />
      Add
    </Button>
  );
}

type PosCartPanelProps = {
  cart: CartItem[];
  total: number;
  totalCost: number;
  isCredit: boolean;
  saleType: SaleType;
  setSaleType: (t: SaleType) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  clients: Client[];
  selectedClientId: string;
  handleClientPick: (id: string) => void;
  customer: { name: string; phone: string; email: string };
  setCustomer: Dispatch<SetStateAction<{ name: string; phone: string; email: string }>>;
  dueDate: string;
  setDueDate: (v: string) => void;
  downPayment: string;
  setDownPayment: (v: string) => void;
  outstanding: number;
  checkoutLoading: boolean;
  canCheckout: boolean;
  onCheckout: () => void;
  onRemoveFromCart: (productId: string) => void;
  businessId: string | null;
  paymentReceipt: PaymentReceipt | null;
  setPaymentReceipt: (receipt: PaymentReceipt | null) => void;
  paidNow: number;
  idPrefix?: string;
  showCheckoutButton?: boolean;
  onBrowseProducts?: () => void;
};

function PosCartEmptyState({ onBrowseProducts }: { onBrowseProducts?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
        <ShoppingCart className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-base font-medium text-foreground">Your cart is empty</p>
      <p className="mt-1.5 max-w-[16rem] text-sm text-muted-foreground">
        Add products from the list using{" "}
        <span className="font-medium text-foreground">Add</span> to start a sale.
      </p>
      {onBrowseProducts && (
        <Button
          type="button"
          variant="outline"
          className="mt-5 min-h-10 touch-manipulation"
          onClick={onBrowseProducts}
        >
          Browse products
        </Button>
      )}
    </div>
  );
}

function PosCartPanel({
  cart,
  total,
  totalCost,
  isCredit,
  saleType,
  setSaleType,
  paymentMethod,
  setPaymentMethod,
  clients,
  selectedClientId,
  handleClientPick,
  customer,
  setCustomer,
  dueDate,
  setDueDate,
  downPayment,
  setDownPayment,
  outstanding,
  checkoutLoading,
  canCheckout,
  onCheckout,
  onRemoveFromCart,
  businessId,
  paymentReceipt,
  setPaymentReceipt,
  paidNow,
  idPrefix = "cart",
  showCheckoutButton = true,
  onBrowseProducts,
}: PosCartPanelProps) {
  if (cart.length === 0) {
    return <PosCartEmptyState onBrowseProducts={onBrowseProducts} />;
  }

  const grossProfit = total - totalCost;
  const showMargin = totalCost > 0;

  return (
    <div className="space-y-4">
      <ul className="space-y-2 text-sm">
        {cart.map((item) => (
          <li
            key={item.productId}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0">
              {item.productName} × {item.quantity}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono tabular-nums">
                {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="touch-manipulation text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${item.productName}`}
                onClick={() => onRemoveFromCart(item.productId)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t pt-4 text-lg font-semibold">
        <span>Total</span>
        <span className="font-mono tabular-nums">{total.toFixed(2)}</span>
      </div>
      {showMargin && (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Est. COGS</span>
            <span className="font-mono tabular-nums">{totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Est. gross profit</span>
            <span
              className={cn(
                "font-mono tabular-nums",
                grossProfit >= 0 ? "text-foreground" : "text-destructive"
              )}
            >
              {grossProfit.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Settlement</p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["IMMEDIATE", "CREDIT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSaleType(t)}
              className={cn(
                "min-h-10 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors touch-manipulation sm:min-h-0 sm:py-1.5",
                saleType === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "IMMEDIATE" ? "Pay now" : "Credit"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          {isCredit ? "Down payment method" : "Payment method"}
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["CASH", "ONLINE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={cn(
                "min-h-10 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors touch-manipulation sm:min-h-0 sm:py-1.5",
                paymentMethod === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "CASH" ? "Cash" : "Online"}
            </button>
          ))}
        </div>
      </div>

      {businessId && (
        <ReceiptUpload
          businessId={businessId}
          category="sales"
          value={paymentReceipt}
          onChange={setPaymentReceipt}
          id={`${idPrefix}-receipt`}
          suggested={
            paymentMethod === "ONLINE" || paidNow > 0 || (!isCredit && total > 0)
          }
        />
      )}

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Customer (required)
        </p>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cust-existing`}>Existing client</Label>
          <select
            id={`${idPrefix}-cust-existing`}
            className="h-10 w-full cursor-pointer rounded-md border bg-background px-3 text-sm touch-manipulation disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground sm:h-9"
            value={selectedClientId}
            disabled={clients.length === 0}
            onChange={(e) => handleClientPick(e.target.value)}
          >
            <option value="">
              {clients.length === 0
                ? "No saved clients yet — enter details below"
                : "New / walk-in customer…"}
            </option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} — {c.phone}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cust-name`}>
              Customer name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-cust-name`}
              required
              value={customer.name}
              onChange={(e) =>
                setCustomer((c) => ({ ...c, name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-cust-phone`}>
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`${idPrefix}-cust-phone`}
              type="tel"
              required
              placeholder="98XXXXXXXX"
              value={customer.phone}
              onChange={(e) =>
                setCustomer((c) => ({ ...c, phone: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cust-email`}>Email (optional)</Label>
          <Input
            id={`${idPrefix}-cust-email`}
            type="email"
            placeholder="name@example.com"
            value={customer.email}
            onChange={(e) =>
              setCustomer((c) => ({ ...c, email: e.target.value }))
            }
          />
        </div>
        {!canCheckout && cart.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Enter customer name and phone to complete checkout.
          </p>
        )}

        {isCredit && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-due-date`}>Due date</Label>
                <Input
                  id={`${idPrefix}-due-date`}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-down-payment`}>Paid now (optional)</Label>
                <Input
                  id={`${idPrefix}-down-payment`}
                  type="number"
                  min={0}
                  max={total}
                  step="0.01"
                  placeholder="0.00"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {outstanding.toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>

      {showCheckoutButton && (
        <Button
          className="min-h-11 w-full touch-manipulation"
          disabled={cart.length === 0 || checkoutLoading || !canCheckout}
          onClick={onCheckout}
        >
          {checkoutLoading
            ? "Processing…"
            : isCredit
              ? "Record credit sale"
              : "Checkout"}
        </Button>
      )}
    </div>
  );
}

export default function PosPage() {
  const { businessId, businesses } = useBusiness();
  const isManufacturer =
    businesses.find((b) => b._id === businessId)?.type === "MANUFACTURER";
  const { confirm } = useConfirm();
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>("IMMEDIATE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [customer, setCustomer] = useState(emptyCustomer);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [cartPulse, setCartPulse] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(
    null
  );

  const isMobileViewport = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  }, []);

  function handleItemAdded(
    product: Product,
    quantity: number,
    wasEmpty: boolean,
    nextItemCount: number
  ) {
    toast.success(`Added ${product.name} × ${quantity}`, {
      description: wasEmpty
        ? "Review payment and checkout below."
        : `${nextItemCount} item${nextItemCount === 1 ? "" : "s"} in cart.`,
      action: {
        label: "Checkout",
        onClick: () => setCartOpen(true),
      },
    });

    if (isMobileViewport()) {
      setCartPulse(true);
      window.setTimeout(() => setCartPulse(false), 600);
      if (wasEmpty) {
        window.setTimeout(() => setCartOpen(true), 350);
      }
    }
  }

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (isManufacturer) params.set("productKind", "FINISHED");
      return `/api/products?${params}`;
    },
    [businessId, search, isManufacturer]
  );

  const {
    items: products,
    meta,
    setPage,
    loading,
    reload: reloadProducts,
  } = usePaginatedList<Product>(buildUrl, [businessId, search]);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/inventory?businessId=${businessId}`)
      .then((r) => r.json())
      .then((json) => {
        const map = new Map<string, number>();
        for (const row of json.data ?? []) {
          map.set(row.productId, row.stock);
        }
        setStockMap(map);
      });
  }, [businessId, products]);

  const loadClients = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(
        `/api/clients?businessId=${businessId}&page=1&pageSize=200`
      );
      const json = await res.json();
      setClients(json.data ?? []);
    } catch {
      setClients([]);
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    void loadClients();
  }, [businessId, loadClients]);

  function handleClientPick(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c._id === clientId);
    setCustomer(
      client
        ? { name: client.name, phone: client.phone, email: client.email ?? "" }
        : emptyCustomer
    );
  }

  function addToCart(product: Product, quantity: number) {
    const stock = stockMap.get(product._id) ?? 0;
    const inCart = cart.find((c) => c.productId === product._id)?.quantity ?? 0;
    const available = Math.max(0, stock - inCart);
    if (available <= 0 || quantity <= 0) {
      toast.error("No more stock available for this product");
      return;
    }

    const qty = Math.min(Math.floor(quantity), available);
    if (qty <= 0) return;

    if (qty < quantity) {
      toast.warning(`Only ${available} available — added ${qty}`);
    }

    const wasEmpty = cart.length === 0;
    const nextItemCount =
      cart.reduce((sum, item) => sum + item.quantity, 0) + qty;

    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product._id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product._id
            ? { ...c, quantity: c.quantity + qty }
            : c
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          productName: product.name,
          quantity: qty,
          unitPrice: product.pricing.selling,
          unitCost: product.pricing.unitCost ?? product.pricing.purchase,
        },
      ];
    });

    handleItemAdded(product, qty, wasEmpty, nextItemCount);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }

  function decrementInCart(productId: string) {
    setCart((prev) => {
      const item = prev.find((c) => c.productId === productId);
      if (!item) return prev;
      if (item.quantity <= 1) {
        return prev.filter((c) => c.productId !== productId);
      }
      return prev.map((c) =>
        c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  }

  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const totalCost = cart.reduce(
    (sum, item) => sum + item.unitCost * item.quantity,
    0
  );
  const grossProfit = total - totalCost;

  const isCredit = saleType === "CREDIT";
  const paidNow = isCredit ? Math.min(Number(downPayment) || 0, total) : total;
  const outstanding = Math.max(0, total - paidNow);

  function resetSaleForm() {
    setCart([]);
    setSaleType("IMMEDIATE");
    setPaymentMethod("CASH");
    setCustomer(emptyCustomer);
    setSelectedClientId("");
    setDueDate("");
    setDownPayment("");
    setPaymentReceipt(null);
  }

  const hasCustomer = Boolean(customer.name.trim() && customer.phone.trim());

  async function checkout() {
    if (!businessId || cart.length === 0) return;

    if (!customer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!customer.phone.trim()) {
      toast.error("Customer phone is required");
      return;
    }
    if (isCredit && !dueDate) {
      toast.error("A due date is required for a credit sale");
      return;
    }

    const lines = cart
      .map(
        (item) =>
          `• ${item.productName} × ${item.quantity} = ${(item.unitPrice * item.quantity).toFixed(2)}`
      )
      .join("\n");

    const marginLine =
      totalCost > 0
        ? `\nEst. COGS: ${totalCost.toFixed(2)}\nEst. gross profit: ${grossProfit.toFixed(2)}`
        : "";

    const summary = isCredit
      ? `${lines}\n\nTotal: ${total.toFixed(2)}${marginLine}\nPaid now: ${paidNow.toFixed(2)}\nOutstanding: ${outstanding.toFixed(2)} (due ${formatDateYmd(dueDate)})`
      : `${lines}\n\nTotal: ${total.toFixed(2)}${marginLine}`;

    const ok = await confirm({
      title: isCredit ? "Complete credit sale?" : "Complete checkout?",
      description: `${summary}\n\nStock will be deducted for these items.`,
      confirmLabel: isCredit ? "Record credit sale" : "Complete sale",
      variant: "warning",
      cancelToast: "Checkout cancelled",
    });
    if (!ok) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          items: cart.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
          paymentMethod,
          saleType,
          customer: {
            name: customer.name.trim(),
            phone: customer.phone.trim(),
            email: customer.email.trim() || undefined,
          },
          ...(isCredit && {
            dueDate: new Date(dueDate).toISOString(),
            amountPaid: paidNow,
          }),
          ...(paymentReceipt && { paymentReceipt }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string" ? json.error : "Checkout failed";
        throw new Error(message);
      }
      toast.success(
        isCredit
          ? `Credit sale ${json.data.invoiceNumber} — ${json.data.amountDue.toFixed(2)} due`
          : `Sale ${json.data.invoiceNumber} — ${json.data.total.toFixed(2)}`
      );
      notifyNotificationsChanged();
      resetSaleForm();
      setCartOpen(false);
      await reloadProducts();
      await loadClients();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const cartPanelProps: PosCartPanelProps = {
    cart,
    total,
    totalCost,
    isCredit,
    saleType,
    setSaleType,
    paymentMethod,
    setPaymentMethod,
    clients,
    selectedClientId,
    handleClientPick,
    customer,
    setCustomer,
    dueDate,
    setDueDate,
    downPayment,
    setDownPayment,
    outstanding,
    checkoutLoading,
    canCheckout: hasCustomer,
    onCheckout: checkout,
    onRemoveFromCart: removeFromCart,
    businessId,
    paymentReceipt,
    setPaymentReceipt,
    paidNow,
  };

  function renderProductActions(product: Product) {
    const stock = stockMap.get(product._id) ?? 0;
    const inCart = cart.find((c) => c.productId === product._id)?.quantity ?? 0;
    const available = Math.max(0, stock - inCart);
    return (
      <PosAddControl
        stock={available}
        inCart={inCart}
        onAdd={(quantity) => addToCart(product, quantity)}
        onDecrement={() => decrementInCart(product._id)}
        onRemove={() => removeFromCart(product._id)}
      />
    );
  }

  return (
    <div className="pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(400px,36%)]">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">POS</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Product → Cart → Checkout → Sale → Inventory deduction. Receive
              stock on Purchases first if available qty is 0.
            </p>
            <p className="mt-2 text-sm text-muted-foreground lg:hidden">
              Tap <span className="font-medium text-foreground">Add</span>, enter
              quantity, then checkout from the bar at the bottom.
            </p>
          </div>
          <Input
            placeholder="Search products (name or SKU)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 sm:h-8"
          />
          <DataTable
            columns={[
              {
                id: "name",
                header: "Product",
                mobilePrimary: true,
                cell: (p) => (
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {p.sku}
                    </span>
                  </div>
                ),
              },
              {
                id: "stock",
                header: "Stock",
                headerClassName: "text-right",
                className: "text-right",
                cell: (p) => {
                  const stock = stockMap.get(p._id) ?? 0;
                  return stock <= 0 ? (
                    <Badge variant="destructive">Out of stock</Badge>
                  ) : (
                    <span className="font-mono">{formatQuantityWithUnit(stock, p.unitId)}</span>
                  );
                },
              },
              {
                id: "price",
                header: "Price",
                headerClassName: "text-right",
                className: "text-right font-mono",
                cell: (p) => p.pricing.selling.toFixed(2),
              },
              {
                id: "add",
                header: "Add",
                headerClassName: "text-right w-[1%] whitespace-nowrap",
                className: "text-right whitespace-nowrap",
                mobileActions: true,
                hideOnMobile: true,
                cell: (p) => renderProductActions(p),
              },
            ]}
            mobileLayout="cards"
            renderMobileCard={(p) => {
              const stock = stockMap.get(p._id) ?? 0;
              const inCart =
                cart.find((c) => c.productId === p._id)?.quantity ?? 0;
              return (
                <article className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{p.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-lg font-semibold tabular-nums">
                      {p.pricing.selling.toFixed(2)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {stock <= 0 ? (
                        <Badge variant="destructive">Out of stock</Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Stock{" "}
                          <span className="font-mono font-medium text-foreground">
                            {formatQuantityWithUnit(stock, p.unitId)}
                          </span>
                        </p>
                      )}
                    </div>
                    {renderProductActions(p)}
                  </div>
                </article>
              );
            }}
            data={products}
            rowKey={(p) => p._id}
            loading={loading}
            emptyMessage="No products match your search."
            meta={meta}
            onPageChange={setPage}
          />
        </div>
        <Card className="hidden min-w-0 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-hidden">
          <CardHeader className="shrink-0">
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-11rem)] overflow-y-auto overscroll-contain">
            <PosCartPanel {...cartPanelProps} idPrefix="cart-desktop" />
          </CardContent>
        </Card>
      </div>

      {!cartOpen && (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background p-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] transition-shadow lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          cartPulse && "shadow-[0_-4px_32px_rgba(79,70,229,0.35)] ring-2 ring-primary/40"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 rounded-lg text-left touch-manipulation disabled:cursor-default"
            disabled={cart.length === 0}
            onClick={() => cart.length > 0 && setCartOpen(true)}
          >
            <p className="truncate text-sm font-medium">
              {cartItemCount > 0
                ? `${cartItemCount} item${cartItemCount === 1 ? "" : "s"} in cart`
                : "Cart empty — add products above"}
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {total.toFixed(2)}
            </p>
          </button>
          <Button
            type="button"
            className="relative min-h-11 shrink-0 touch-manipulation px-5"
            disabled={cart.length === 0}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="size-4" />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
            {cart.length > 0 ? "Checkout" : "View cart"}
          </Button>
        </div>
      </div>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex h-[min(92dvh,720px)] max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl p-0"
        >
          <div className="relative shrink-0 border-b px-4 py-3">
            <SheetTitle className="pr-28 text-lg font-semibold">
              {cart.length > 0 ? "Checkout" : "Cart"}
            </SheetTitle>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-3 top-1/2 min-h-9 -translate-y-1/2 touch-manipulation gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Cancel checkout"
                />
              }
            >
              <Trash2 className="size-4 shrink-0" aria-hidden />
              <span className="text-sm font-medium">Cancel</span>
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <PosCartPanel
              {...cartPanelProps}
              idPrefix="cart-mobile"
              showCheckoutButton={false}
              onBrowseProducts={() => setCartOpen(false)}
            />
          </div>
          {cart.length > 0 && (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total
                </span>
                <span className="font-mono text-xl font-semibold tabular-nums">
                  {total.toFixed(2)}
                </span>
              </div>
              <Button
                className="min-h-11 w-full touch-manipulation"
                disabled={checkoutLoading || !hasCustomer}
                onClick={checkout}
              >
                {checkoutLoading
                  ? "Processing…"
                  : isCredit
                    ? "Record credit sale"
                    : "Complete checkout"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
