import { Injectable } from '@nestjs/common';
import {
  PlatformPlansRepository,
  PublicPlanWithFeatures,
} from '../repositories/platform-plans.repository';
import { PublicPlanResponseDto } from '../dtos';

@Injectable()
export class PublicPlansService {
  constructor(private readonly plansRepository: PlatformPlansRepository) {}

  async findAll(): Promise<PublicPlanResponseDto[]> {
    const plans = await this.plansRepository.findPublicPlans();
    return plans.map((plan) => this.toResponse(plan));
  }

  private toResponse(plan: PublicPlanWithFeatures): PublicPlanResponseDto {
    const features = this.mapFeatures(plan);
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.monthlyPrice.toFixed(2),
      priceYearly: plan.yearlyPrice?.toFixed(2) ?? null,
      currency: plan.currency,
      shipmentLimit: plan.monthlyShipmentLimit,
      features,
      isPopular: plan.isPopular,
      ctaLabel: 'Request Demo',
      ctaHref: `/request-demo?plan=${plan.slug}`,
    };
  }

  private mapFeatures(plan: PublicPlanWithFeatures): string[] {
    const flagNames = plan.featureFlags
      .map((flag) => flag.featureFlag?.name)
      .filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      );

    if (flagNames.length > 0) {
      return flagNames;
    }

    if (
      plan.metadata &&
      typeof plan.metadata === 'object' &&
      'publicFeatures' in plan.metadata &&
      Array.isArray((plan.metadata as Record<string, unknown>).publicFeatures)
    ) {
      return (
        (plan.metadata as Record<string, unknown>).publicFeatures as string[]
      ).filter((f): f is string => typeof f === 'string');
    }

    return [];
  }
}
