# Generated manually for ForkDeal model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('game', '0005_session_max_deals_session_seed'),
    ]

    operations = [
        migrations.CreateModel(
            name='ForkDeal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dealer', models.CharField(choices=[('N', 'North'), ('S', 'South'), ('E', 'East'), ('W', 'West')], max_length=1)),
                ('vulnerability', models.CharField(choices=[('None', 'None'), ('NS', 'NS'), ('EW', 'EW'), ('Both', 'Both')], max_length=20)),
                ('hands', models.JSONField(default=dict)),
                ('auction_history', models.JSONField(default=list)),
                ('is_complete', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('original_deal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='forks', to='game.deal')),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]