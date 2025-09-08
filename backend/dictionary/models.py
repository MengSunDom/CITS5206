from django.db import models

class SystemDictionary(models.Model):
    category = models.CharField(max_length=50)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        unique_together = ('category', 'code')

    def __str__(self):
        return f'{self.category}:{self.code}'
